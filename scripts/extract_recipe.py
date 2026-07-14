#!/usr/bin/env python3
"""Extract recipe fields from a food.ru HTML page.

The regex logic here mirrors the extractors in app/actions/generate-prompt.ts
so the shell pipeline (parse_recipe.sh) and the Next.js server action stay in
sync. Reads an HTML file and prints one requested field.

Usage: extract_recipe.py <html_file> <field>
  field: title | time_minutes | category | description | image | servings | ingredients | steps
"""

import re
import sys


# Value of `attr` from the first tag that has itemprop="prop"
def extract_attr(html, prop, attr):
    patterns = [
        rf'<[^>]+itemprop="{prop}"[^>]*\s{attr}="([^"]*)"',
        rf'<[^>]+\s{attr}="([^"]*)"[^>]*itemprop="{prop}"',
    ]
    for pat in patterns:
        m = re.search(pat, html, re.IGNORECASE)
        if m:
            return m.group(1)
    return ""


# Inner HTML of the first element with itemprop="prop", with nesting support
def extract_inner_html(html, prop):
    m = re.search(rf'<[a-zA-Z][^>]+itemprop="{prop}"', html, re.IGNORECASE)
    if not m:
        return ""
    tag_start = m.start()
    name_m = re.match(r"<([a-zA-Z]+)", html[tag_start:])
    if not name_m:
        return ""
    tag = name_m.group(1)
    open_re = re.compile(rf"<{tag}[\s>]", re.IGNORECASE)
    close_re = re.compile(rf"</{tag}>", re.IGNORECASE)
    depth = 0
    i = tag_start
    while i < len(html):
        om = open_re.search(html, i)
        cm = close_re.search(html, i)
        if not cm:
            break
        if om and om.start() < cm.start():
            depth += 1
            i = om.start() + 1
        else:
            depth -= 1
            i = cm.start() + 1
            if depth == 0:
                inner_start = html.index(">", tag_start) + 1
                return html[inner_start:cm.start()]
    return ""


def to_text(html):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", html)).strip()


def extract_text(html, prop):
    return to_text(extract_inner_html(html, prop))


# Recipe title: the <h1 itemprop="name"> element, not the first itemprop="name"
# on the page (which is a breadcrumb). Falls back to the first itemprop="name".
def extract_title(html):
    m = re.search(r'<h1[^>]*itemprop="name"[^>]*>(.*?)</h1>', html, re.IGNORECASE | re.DOTALL)
    if m:
        text = to_text(m.group(1))
        if text:
            return text
    return extract_text(html, "name")


# Text of ALL elements with itemprop="prop"
def extract_all_text(html, prop):
    results = []
    for m in re.finditer(rf'<[^>]+itemprop="{prop}"[^>]*>', html, re.IGNORECASE):
        tag_close = html.find(">", m.start())
        name_m = re.match(r"<([a-zA-Z]+)", html[m.start():])
        if not name_m:
            continue
        tag = name_m.group(1)
        inner_start = tag_close + 1
        inner_end = html.find(f"</{tag}>", inner_start)
        if inner_end == -1:
            continue
        text = to_text(html[inner_start:inner_end])
        if text:
            results.append(text)
    return results


# Raw HTML of ALL elements with itemprop="prop", with nesting support
def extract_all_html(html, prop):
    results = []
    for m in re.finditer(rf'<([a-zA-Z]+)[^>]+itemprop="{prop}"[^>]*>', html, re.IGNORECASE):
        tag = m.group(1)
        el_start = m.start()
        open_re = re.compile(rf"<{tag}[\s>]", re.IGNORECASE)
        close_re = re.compile(rf"</{tag}>", re.IGNORECASE)
        depth = 0
        i = el_start
        while i < len(html):
            om = open_re.search(html, i)
            cm = close_re.search(html, i)
            if not cm:
                break
            if om and om.start() < cm.start():
                depth += 1
                i = om.start() + 1
            else:
                depth -= 1
                i = cm.start() + 1
                if depth == 0:
                    results.append(html[el_start:cm.start() + len(tag) + 3])
                    break
    return results


def parse_iso_duration(iso):
    h = re.search(r"(\d+)H", iso)
    mi = re.search(r"(\d+)M", iso)
    total = (int(h.group(1)) * 60 if h else 0) + (int(mi.group(1)) if mi else 0)
    return total if total > 0 else 30


# Recipe yield: the recipeYield content attr ("2"), falling back to the
# JSON-LD "recipeYield":"2 порции" value.
def extract_servings(html):
    servings = extract_attr(html, "recipeYield", "content")
    if servings:
        return servings
    m = re.search(r'"recipeYield":"([^"]*)"', html, re.IGNORECASE)
    return m.group(1) if m else ""


# Best cover image: fit/1200 webp (recipe cover, not fill/ which is avatars)
def extract_food_ru_image(html):
    urls = re.findall(r'https://cdn\.food\.ru/unsigned/fit/\S+?\.webp(?=[ ",])', html)
    for u in urls:
        if "/1200/" in u:
            return u
    return urls[0] if urls else ""


def main():
    if len(sys.argv) != 3:
        print("Usage: extract_recipe.py <html_file> <field>", file=sys.stderr)
        sys.exit(1)
    html_file, field = sys.argv[1], sys.argv[2]
    with open(html_file, encoding="utf-8") as f:
        html = f.read()

    if field == "title":
        print(extract_title(html))
    elif field == "time_minutes":
        print(parse_iso_duration(extract_attr(html, "totalTime", "content")))
    elif field == "category":
        print(extract_attr(html, "recipeCategory", "content") or extract_text(html, "recipeCategory"))
    elif field == "description":
        print(extract_text(html, "description"))
    elif field == "image":
        print(extract_food_ru_image(html))
    elif field == "servings":
        print(extract_servings(html))
    elif field == "ingredients":
        print("\n".join(extract_all_text(html, "recipeIngredient")))
    elif field == "steps":
        print("\n".join(extract_all_html(html, "recipeInstructions")))
    else:
        print(f"Unknown field: {field}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
