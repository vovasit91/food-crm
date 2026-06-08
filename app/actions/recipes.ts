"use server";

import { db } from "@/db";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  recipes,
  translations,
  recipeTag,
  recipeKitchenItem,
  recipeVariation,
  recipeIngredient,
  recipeIngredientSubstitutes,
  recipeCookingStep,
  cookingStepTag,
  cookingStepIngredient,
  recipeTldrStep,
} from "@/db/generated/schema";

export type PortionType = "portion" | "piece";

export async function updateRecipeBasic(
  id: string,
  data: { image: string; timeMinutes: number; difficulty: string; isEnabled: boolean; basePortions: number; portionType: PortionType }
) {
  await db
    .update(recipes)
    .set({
      image: data.image,
      timeMinutes: data.timeMinutes,
      difficulty: data.difficulty,
      isEnabled: data.isEnabled ? 1 : 0,
      basePortions: data.basePortions,
      portionType: data.portionType,
    })
    .where(eq(recipes.id, id));
  revalidatePath(`/recipes/${id}`);
  revalidatePath("/recipes");
}

export async function upsertTranslations(
  items: { locale: string; entityType: string; entityId: string; value: string }[]
) {
  for (const item of items) {
    await db
      .insert(translations)
      .values(item)
      .onConflictDoUpdate({
        target: [translations.locale, translations.entityType, translations.entityId],
        set: { value: item.value },
      });
  }
}

export async function updateRecipeTags(recipeId: string, tagIds: string[]) {
  await db.delete(recipeTag).where(eq(recipeTag.recipeId, recipeId));
  if (tagIds.length > 0) {
    await db.insert(recipeTag).values(tagIds.map((tagId) => ({ recipeId, tagId })));
  }
  revalidatePath(`/recipes/${recipeId}`);
}

export async function updateRecipeKitchenItems(recipeId: string, itemIds: string[]) {
  await db.delete(recipeKitchenItem).where(eq(recipeKitchenItem.recipeId, recipeId));
  if (itemIds.length > 0) {
    await db
      .insert(recipeKitchenItem)
      .values(itemIds.map((kitchenItemId) => ({ recipeId, kitchenItemId })));
  }
  revalidatePath(`/recipes/${recipeId}`);
}

export async function updateRecipeIngredients(
  recipeId: string,
  items: {
    ingredientId: string;
    sortOrder: number;
    quantity: number | null;
    unit: string | null;
    optional: boolean;
    portionCoefficient: number;
  }[]
) {
  await db
    .delete(recipeIngredientSubstitutes)
    .where(eq(recipeIngredientSubstitutes.recipeId, recipeId));
  await db.delete(recipeIngredient).where(eq(recipeIngredient.recipeId, recipeId));
  if (items.length > 0) {
    await db.insert(recipeIngredient).values(
      items.map((ing) => ({
        recipeId,
        ingredientId: ing.ingredientId,
        sortOrder: ing.sortOrder,
        quantity: ing.quantity,
        unit: ing.unit,
        optional: ing.optional ? 1 : 0,
        portionCoefficient: ing.portionCoefficient,
      }))
    );
  }
  revalidatePath(`/recipes/${recipeId}`);
}

export async function updateRecipeCookingSteps(
  recipeId: string,
  steps: {
    step: string;
    sortOrder: number;
    duration: number;
    showTimer: boolean;
    image: string | null;
    titleEn: string;
    titleUa: string;
    descriptionEn: string;
    descriptionUa: string;
    stepIngredients: { ingredientId: string; quantity: number | null; unit: string | null; sortOrder: number }[];
    tagIds: string[];
  }[]
) {
  await db.delete(cookingStepIngredient).where(eq(cookingStepIngredient.recipeId, recipeId));
  await db.delete(cookingStepTag).where(eq(cookingStepTag.recipeId, recipeId));
  await db.delete(recipeCookingStep).where(eq(recipeCookingStep.recipeId, recipeId));

  if (steps.length > 0) {
    await db.insert(recipeCookingStep).values(
      steps.map((s) => ({
        recipeId,
        step: s.step,
        sortOrder: s.sortOrder,
        duration: s.duration,
        showTimer: s.showTimer ? 1 : 0,
        image: s.image,
      }))
    );

    const translationItems: { locale: string; entityType: string; entityId: string; value: string }[] = [];
    for (const s of steps) {
      if (s.titleEn) translationItems.push({ locale: "en", entityType: "step_title", entityId: s.step, value: s.titleEn });
      if (s.titleUa) translationItems.push({ locale: "ua", entityType: "step_title", entityId: s.step, value: s.titleUa });
      if (s.descriptionEn) translationItems.push({ locale: "en", entityType: "step_description", entityId: s.step, value: s.descriptionEn });
      if (s.descriptionUa) translationItems.push({ locale: "ua", entityType: "step_description", entityId: s.step, value: s.descriptionUa });
    }
    if (translationItems.length > 0) await upsertTranslations(translationItems);

    const allStepIngredients = steps.flatMap((s) =>
      s.stepIngredients.map((si) => ({
        recipeId,
        step: s.step,
        ingredientId: si.ingredientId,
        quantity: si.quantity,
        unit: si.unit,
        sortOrder: si.sortOrder,
      }))
    );
    if (allStepIngredients.length > 0) {
      await db.insert(cookingStepIngredient).values(allStepIngredients);
    }

    const allStepTags = steps.flatMap((s) =>
      s.tagIds.map((tag) => ({ recipeId, step: s.step, tag }))
    );
    if (allStepTags.length > 0) {
      await db.insert(cookingStepTag).values(allStepTags);
    }
  }

  revalidatePath(`/recipes/${recipeId}`);
}

export async function deleteRecipe(id: string) {
  await db.delete(cookingStepIngredient).where(eq(cookingStepIngredient.recipeId, id));
  await db.delete(cookingStepTag).where(eq(cookingStepTag.recipeId, id));
  await db.delete(recipeCookingStep).where(eq(recipeCookingStep.recipeId, id));
  await db.delete(recipeTldrStep).where(eq(recipeTldrStep.recipeId, id));
  await db.delete(recipeIngredientSubstitutes).where(eq(recipeIngredientSubstitutes.recipeId, id));
  await db.delete(recipeIngredient).where(eq(recipeIngredient.recipeId, id));
  await db.delete(recipeKitchenItem).where(eq(recipeKitchenItem.recipeId, id));
  await db.delete(recipeTag).where(eq(recipeTag.recipeId, id));
  await db.delete(recipeVariation).where(eq(recipeVariation.recipeId, id));
  await db.delete(translations).where(eq(translations.entityId, id));
  await db.delete(recipes).where(eq(recipes.id, id));
  redirect("/recipes");
}

export async function updateRecipeTldrSteps(
  recipeId: string,
  steps: { stepId: string; sortOrder: number; minutes: number; titleEn: string; titleUa: string }[]
) {
  await db.delete(recipeTldrStep).where(eq(recipeTldrStep.recipeId, recipeId));

  if (steps.length > 0) {
    await db.insert(recipeTldrStep).values(
      steps.map((s) => ({ recipeId, stepId: s.stepId, sortOrder: s.sortOrder, minutes: s.minutes }))
    );

    const translationItems: { locale: string; entityType: string; entityId: string; value: string }[] = [];
    for (const s of steps) {
      if (s.titleEn) translationItems.push({ locale: "en", entityType: "tldr_step", entityId: s.stepId, value: s.titleEn });
      if (s.titleUa) translationItems.push({ locale: "ua", entityType: "tldr_step", entityId: s.stepId, value: s.titleUa });
    }
    if (translationItems.length > 0) await upsertTranslations(translationItems);
  }

  revalidatePath(`/recipes/${recipeId}`);
}
