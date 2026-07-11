import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { eq } from "drizzle-orm";
import type { PortionType } from "@/app/actions/recipes";
import {
  ingredients,
  recipes,
  recipeTag,
  recipeKitchenItem,
  recipeVariation,
  recipeTldrStep,
  recipeIngredient,
  recipeIngredientSubstitutes,
  recipeCookingStep,
  cookingStepTag,
  cookingStepIngredient,
  translations,
} from "@/db/generated/schema";

type Translations = { en?: string; ua?: string };

export interface TldrStep {
  stepId: string;
  minutes: number;
  translations?: { title?: Translations };
}

export interface Ingredient {
  ingredientId: string;
  quantity?: number;
  unit?: string;
  optional?: boolean;
  portionCoefficient?: number;
  substitutes?: string[];
}

export interface CookingStep {
  stepId: string;
  image?: string;
  duration: number;
  showTimer?: boolean;
  tags?: string[];
  ingredients?: { ingredientId: string; quantity?: number; unit?: string; sortOrder?: number }[];
  translations?: { title?: Translations; description?: Translations };
}

export interface ImportRecipe {
  id: string;
  image: string;
  title?: Translations;
  recipeSummary?: Translations;
  timeMinutes: number;
  difficulty: string;
  basePortions?: number;
  portionType?: PortionType;
  sourceUrl?: string;
  tags?: string[];
  kitchen?: string[];
  variations?: string[];
  tldrSteps?: TldrStep[];
  ingredients?: Ingredient[];
  cookingSteps?: CookingStep[];
}

export interface ImportResult {
  recipesInserted: number;
  recipesSkipped: number;
  ingredientsInserted: number;
  errors: string[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = LibSQLDatabase<any>;

async function upsertTranslation(
  db: AnyDb,
  locale: string,
  entityType: string,
  entityId: string,
  value: string,
) {
  if (!value) return;
  await db
    .insert(translations)
    .values({ locale, entityType, entityId, value })
    .onConflictDoNothing();
}

export async function importRecipesFromData(
  db: AnyDb,
  forImportRecipes: ImportRecipe[],
): Promise<ImportResult> {
  const result: ImportResult = {
    recipesInserted: 0,
    recipesSkipped: 0,
    ingredientsInserted: 0,
    errors: [],
  };

  const allIngredientIds = new Set<string>(
    forImportRecipes.flatMap((r) => r.ingredients?.map((i) => i.ingredientId) ?? []),
  );

  for (const id of allIngredientIds) {
    const existing = await db
      .select({ id: ingredients.id })
      .from(ingredients)
      .where(eq(ingredients.id, id));
    if (existing.length > 0) continue;

    await db.insert(ingredients).values({
      id,
      category: "pantry",
      icon: "Leaf",
      measurement: "g",
    });
    result.ingredientsInserted++;
  }

  for (const r of forImportRecipes) {
    try {
      const existing = await db
        .select({ id: recipes.id })
        .from(recipes)
        .where(eq(recipes.id, r.id));

      if (existing.length > 0) {
        result.recipesSkipped++;
        continue;
      }

      await db.insert(recipes).values({
        id: r.id,
        image: r.image,
        timeMinutes: r.timeMinutes,
        difficulty: r.difficulty,
        basePortions: r.basePortions ?? 1,
        portionType: r.portionType ?? "portion",
        sourceUrl: r.sourceUrl ?? null,
      });

      for (const tagId of r.tags ?? []) {
        await db.insert(recipeTag).values({ recipeId: r.id, tagId }).onConflictDoNothing();
      }

      for (const kitchenItemId of r.kitchen ?? []) {
        await db.insert(recipeKitchenItem).values({ recipeId: r.id, kitchenItemId }).onConflictDoNothing();
      }

      for (const variationRecipeId of r.variations ?? []) {
        await db.insert(recipeVariation).values({ recipeId: r.id, variationRecipeId }).onConflictDoNothing();
      }

      for (const [i, s] of (r.tldrSteps ?? []).entries()) {
        await db.insert(recipeTldrStep).values({
          recipeId: r.id,
          stepId: s.stepId,
          sortOrder: i,
          minutes: s.minutes,
        });
        await upsertTranslation(db, "en", "tldr_step", s.stepId, s.translations?.title?.en ?? "");
        await upsertTranslation(db, "ua", "tldr_step", s.stepId, s.translations?.title?.ua ?? "");
      }

      const seenIngredientIds = new Set<string>();
      for (const [i, ing] of (r.ingredients ?? []).entries()) {
        if (seenIngredientIds.has(ing.ingredientId)) continue;
        seenIngredientIds.add(ing.ingredientId);

        await db.insert(recipeIngredient).values({
          recipeId: r.id,
          ingredientId: ing.ingredientId,
          sortOrder: i,
          quantity: ing.quantity ?? null,
          unit: ing.unit ?? null,
          optional: ing.optional ? 1 : 0,
          portionCoefficient: ing.portionCoefficient ?? 1,
        });

        for (const substituteIngredientId of ing.substitutes ?? []) {
          await db
            .insert(recipeIngredientSubstitutes)
            .values({ recipeId: r.id, ingredientId: ing.ingredientId, substituteIngredientId })
            .onConflictDoNothing();
        }
      }

      for (const [i, cs] of (r.cookingSteps ?? []).entries()) {
        await db.insert(recipeCookingStep).values({
          recipeId: r.id,
          step: cs.stepId,
          sortOrder: i,
          duration: cs.duration,
          showTimer: cs.showTimer ? 1 : 0,
          image: cs.image ?? null,
        });

        for (const tag of cs.tags ?? []) {
          await db.insert(cookingStepTag).values({ recipeId: r.id, step: cs.stepId, tag }).onConflictDoNothing();
        }

        for (const [j, si] of (cs.ingredients ?? []).entries()) {
          await db
            .insert(cookingStepIngredient)
            .values({
              recipeId: r.id,
              step: cs.stepId,
              ingredientId: si.ingredientId,
              quantity: si.quantity ?? null,
              unit: si.unit ?? null,
              sortOrder: si.sortOrder ?? j,
            })
            .onConflictDoNothing();
        }

        await upsertTranslation(db, "en", "step_title", cs.stepId, cs.translations?.title?.en ?? "");
        await upsertTranslation(db, "ua", "step_title", cs.stepId, cs.translations?.title?.ua ?? "");
        await upsertTranslation(db, "en", "step_description", cs.stepId, cs.translations?.description?.en ?? "");
        await upsertTranslation(db, "ua", "step_description", cs.stepId, cs.translations?.description?.ua ?? "");
      }

      await upsertTranslation(db, "en", "recipe_name", r.id, r.title?.en ?? "");
      await upsertTranslation(db, "ua", "recipe_name", r.id, r.title?.ua ?? "");
      await upsertTranslation(db, "en", "recipe_summary", r.id, r.recipeSummary?.en ?? "");
      await upsertTranslation(db, "ua", "recipe_summary", r.id, r.recipeSummary?.ua ?? "");

      result.recipesInserted++;
    } catch (e) {
      result.errors.push(`${r.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return result;
}
