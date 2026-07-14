import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import {
  importRecipesFromData,
  type ImportRecipe,
} from "../lib/import-recipes";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FOR_IMPORT = join(__dirname, "..", "for_import");

// Load .env if TURSO_URL not already in environment
if (!process.env.TURSO_URL) {
  const envContent = readFileSync(join(__dirname, "..", ".env"), "utf-8");
  for (const line of envContent.split("\n")) {
    const m = line.match(/^([^=]+)=(.+)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^'|'$/g, "");
  }
}

async function main() {
  const client = createClient({
    url: process.env.TURSO_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  });

  const db = drizzle(client);

  console.log("Reading for_import/recipes.json…\n");

  const forImportRecipes: ImportRecipe[] = JSON.parse(
    readFileSync(join(FOR_IMPORT, "recipes.json"), "utf-8"),
  );

  const result = await importRecipesFromData(db, forImportRecipes);

  for (const err of result.errors) console.error(" error:", err);

  client.close();

  console.log(
    `\nDone — ${result.recipesInserted} recipes inserted, ${result.recipesSkipped} skipped, ${result.ingredientsInserted} ingredients inserted.`,
  );
}

main();
