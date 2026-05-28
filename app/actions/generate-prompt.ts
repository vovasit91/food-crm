"use server";

import { readFileSync } from "fs";
import { join } from "path";
import { db } from "@/db";
import { ingredients, tags, kitchenItems, translations } from "@/db/generated/schema";
import { eq, and } from "drizzle-orm";

// Extract the value of `attr` from the first tag that has itemprop="prop"
function extractAttr(html: string, prop: string, attr: string): string {
  const patterns = [
    new RegExp(`<[^>]+itemprop="${prop}"[^>]+\\s${attr}="([^"]*)"`, "i"),
    new RegExp(`<[^>]+\\s${attr}="([^"]*)"[^>]+itemprop="${prop}"`, "i"),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m) return m[1];
  }
  return "";
}

// Find the inner HTML of the first element with itemprop="prop"
function extractInnerHtml(html: string, prop: string): string {
  const tagStart = html.search(new RegExp(`<[a-zA-Z][^>]+itemprop="${prop}"`, "i"));
  if (tagStart === -1) return "";
  const tagNameM = html.slice(tagStart).match(/^<([a-zA-Z]+)/);
  if (!tagNameM) return "";
  const tagName = tagNameM[1];
  let depth = 0;
  let i = tagStart;
  const openRe = new RegExp(`<${tagName}[\\s>]`, "gi");
  const closeRe = new RegExp(`</${tagName}>`, "gi");
  openRe.lastIndex = tagStart;
  closeRe.lastIndex = tagStart;
  while (i < html.length) {
    openRe.lastIndex = i;
    closeRe.lastIndex = i;
    const openM = openRe.exec(html);
    const closeM = closeRe.exec(html);
    if (!closeM) break;
    if (openM && openM.index < closeM.index) {
      depth++;
      i = openM.index + 1;
    } else {
      depth--;
      i = closeM.index + 1;
      if (depth === 0) {
        const innerStart = html.indexOf(">", tagStart) + 1;
        return html.slice(innerStart, closeM.index);
      }
    }
  }
  return "";
}

function toText(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

// Extract text from first element with itemprop="prop"
function extractText(html: string, prop: string): string {
  return toText(extractInnerHtml(html, prop));
}

// Extract text from ALL elements with itemprop="prop"
function extractAllText(html: string, prop: string): string[] {
  const results: string[] = [];
  const re = new RegExp(`<[^>]+itemprop="${prop}"[^>]*>`, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const tagClose = html.indexOf(">", m.index);
    const tagNameM = html.slice(m.index).match(/^<([a-zA-Z]+)/);
    if (!tagNameM) continue;
    const tagName = tagNameM[1];
    const innerStart = tagClose + 1;
    const innerEnd = html.indexOf(`</${tagName}>`, innerStart);
    if (innerEnd === -1) continue;
    const text = toText(html.slice(innerStart, innerEnd));
    if (text) results.push(text);
  }
  return results;
}

// Extract raw HTML of ALL elements with itemprop="prop", with proper nesting support
function extractAllHtml(html: string, prop: string): string[] {
  const results: string[] = [];
  const startRe = new RegExp(`<([a-zA-Z]+)[^>]+itemprop="${prop}"[^>]*>`, "gi");
  let m: RegExpExecArray | null;
  while ((m = startRe.exec(html)) !== null) {
    const tagName = m[1];
    const elStart = m.index;
    const openRe = new RegExp(`<${tagName}[\\s>]`, "gi");
    const closeRe = new RegExp(`</${tagName}>`, "gi");
    let depth = 0;
    let i = elStart;
    while (i < html.length) {
      openRe.lastIndex = i;
      closeRe.lastIndex = i;
      const openNext = openRe.exec(html);
      const closeNext = closeRe.exec(html);
      if (!closeNext) break;
      if (openNext && openNext.index < closeNext.index) {
        depth++;
        i = openNext.index + 1;
      } else {
        depth--;
        i = closeNext.index + 1;
        if (depth === 0) {
          results.push(html.slice(elStart, closeNext.index + tagName.length + 3));
          break;
        }
      }
    }
  }
  return results;
}

function parseISODuration(iso: string): number {
  const h = iso.match(/(\d+)H/);
  const min = iso.match(/(\d+)M/);
  const total = (h ? parseInt(h[1]) * 60 : 0) + (min ? parseInt(min[1]) : 0);
  return total > 0 ? total : 30;
}

function extractFoodRuImage(html: string): string {
  const re = /https:\/\/cdn\.food\.ru\/unsigned\/fit\/\S+?\.webp(?=[ ",])/g;
  const urls: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) urls.push(m[0]);
  return urls.find(u => u.includes("/1200/")) ?? urls[0] ?? "";
}

export async function generatePrompt(url: string): Promise<string> {
  const [res, ingredientRows, tagRows, kitchenRows] = await Promise.all([
    fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
        "Accept-Encoding": "gzip, deflate, br",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
        "Sec-CH-UA": '"Chromium";v="136", "Google Chrome";v="136", "Not.A/Brand";v="99"',
        "Sec-CH-UA-Mobile": "?0",
        "Sec-CH-UA-Platform": '"Windows"',
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Upgrade-Insecure-Requests": "1",
      },
    }),
    db.select({ id: ingredients.id, label: translations.value })
      .from(ingredients)
      .leftJoin(translations, and(
        eq(translations.entityId, ingredients.id),
        eq(translations.locale, "en"),
        eq(translations.entityType, "ingredient"),
      )),
    db.select({ id: tags.id, label: translations.value })
      .from(tags)
      .leftJoin(translations, and(
        eq(translations.entityId, tags.id),
        eq(translations.locale, "en"),
        eq(translations.entityType, "tag"),
      )),
    db.select({ id: kitchenItems.id }).from(kitchenItems),
  ]);

  if (!res.ok) throw new Error(`Failed to fetch URL: ${res.status} ${res.statusText}`);
  const html = await res.text();

  const title = extractText(html, "name");
  const timeRaw = extractAttr(html, "totalTime", "content");
  const description = extractText(html, "description");
  const category = extractAttr(html, "recipeCategory", "content") || extractText(html, "recipeCategory");
  const image = extractFoodRuImage(html);
  const timeMinutes = parseISODuration(timeRaw);
  const ingredientsRaw = extractAllText(html, "recipeIngredient").join("\n");
  const stepsRaw = extractAllHtml(html, "recipeInstructions").join("\n");

  const ingredientIds = ingredientRows
    .map(r => r.label ? `  ${r.id}: ${r.label}` : `  ${r.id}`)
    .join("\n");
  const tagIds = tagRows
    .map(r => r.label ? `  ${r.id}: ${r.label}` : `  ${r.id}`)
    .join("\n");
  const kitchenIds = kitchenRows.map(r => r.id).join(", ");

  const promptTemplate = readFileSync(join(process.cwd(), "data/agent_prompt.txt"), "utf-8");

  return `${promptTemplate}

---

## RAW RECIPE DATA

**URL:** ${url}
**Title (Russian):** ${title}
**Total time (minutes):** ${timeMinutes}
**Category:** ${category}
**Description (from page):** ${description}
**Cover image URL:** ${image}

**Ingredients (raw from page, one per line):**
${ingredientsRaw}

**Cooking steps (raw HTML elements, may include step images):**
${stepsRaw}

---

## AVAILABLE IDs FROM DATABASE

### Ingredients (id: English name)
${ingredientIds}

### Tags
${tagIds}

### Kitchen items
${kitchenIds}`;
}
