"use server";

import { db } from "@/db";
import { importRecipesFromData, type ImportRecipe, type ImportResult } from "@/lib/import-recipes";
import { publishContent } from "@/app/actions/publish";

export async function importSingleRecipe(recipe: ImportRecipe): Promise<ImportResult> {
  return importRecipesFromData(db, [recipe]);
}

export async function bumpVersion(): Promise<void> {
  await publishContent();
}
