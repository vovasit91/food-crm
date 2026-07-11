import { db } from "@/db";
import {
  ingredients,
  kitchenItems,
  recipeIngredient,
  recipeIngredientSubstitutes,
  recipeKitchenItem,
  recipeCookingStep,
  cookingStepIngredient,
  cookingStepTag,
  recipeTldrStep,
  recipeTag,
  recipeVariation,
  recipes,
  tags,
  translations,
} from "@/db/generated/schema";
import { and, eq, inArray, ne } from "drizzle-orm";
import type { PortionType } from "@/app/actions/recipes";
import { notFound } from "next/navigation";
import RecipeEditor from "./RecipeEditor";

export const dynamic = "force-dynamic";

export default async function RecipePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [recipe] = await db.select().from(recipes).where(eq(recipes.id, id));
  if (!recipe) notFound();

  // Recipe-level translations (name + summary)
  const recipeTranslations = await db
    .select()
    .from(translations)
    .where(
      and(
        eq(translations.entityId, id),
        inArray(translations.entityType, ["recipe_name", "recipe_summary"])
      )
    );

  const getTr = (locale: string, type: string) =>
    recipeTranslations.find((t) => t.locale === locale && t.entityType === type)?.value ?? "";

  // Tags
  const currentTagIds = (
    await db.select({ tagId: recipeTag.tagId }).from(recipeTag).where(eq(recipeTag.recipeId, id))
  ).map((r) => r.tagId);

  const allTagsData = await db.select({ id: tags.id, label: tags.label }).from(tags).where(eq(tags.type, "category")).orderBy(tags.id);

  const allStepTagsData = await db.select({ id: tags.id, label: tags.label }).from(tags).where(eq(tags.type, "recipe_step")).orderBy(tags.id);

  // Kitchen items
  const currentKitchenItemIds = (
    await db
      .select({ kitchenItemId: recipeKitchenItem.kitchenItemId })
      .from(recipeKitchenItem)
      .where(eq(recipeKitchenItem.recipeId, id))
  ).map((r) => r.kitchenItemId);

  const allKitchenItemsData = await db
    .select({ id: kitchenItems.id })
    .from(kitchenItems)
    .orderBy(kitchenItems.id);

  // Ingredients
  const recipeIngredients = await db
    .select({
      ingredientId: recipeIngredient.ingredientId,
      sortOrder: recipeIngredient.sortOrder,
      quantity: recipeIngredient.quantity,
      unit: recipeIngredient.unit,
      optional: recipeIngredient.optional,
      portionCoefficient: recipeIngredient.portionCoefficient,
    })
    .from(recipeIngredient)
    .where(eq(recipeIngredient.recipeId, id))
    .orderBy(recipeIngredient.sortOrder);

  const allIngredientsData = await db
    .select({
      id: ingredients.id,
      category: ingredients.category,
      measurement: ingredients.measurement,
      name: translations.value,
    })
    .from(ingredients)
    .leftJoin(
      translations,
      and(
        eq(translations.entityType, "ingredient"),
        eq(translations.entityId, ingredients.id),
        eq(translations.locale, "en")
      )
    )
    .orderBy(ingredients.id);

  const ingredientMap = Object.fromEntries(allIngredientsData.map((i) => [i.id, i]));

  // Ingredient substitutes
  const substitutesData = await db
    .select()
    .from(recipeIngredientSubstitutes)
    .where(eq(recipeIngredientSubstitutes.recipeId, id));

  const substitutesMap: Record<string, string[]> = {};
  for (const s of substitutesData) {
    if (!substitutesMap[s.ingredientId]) substitutesMap[s.ingredientId] = [];
    substitutesMap[s.ingredientId].push(s.substituteIngredientId);
  }

  // Variations
  const variationIds = (
    await db
      .select({ variationRecipeId: recipeVariation.variationRecipeId })
      .from(recipeVariation)
      .where(eq(recipeVariation.recipeId, id))
  ).map((r) => r.variationRecipeId);

  const allRecipesData = await db
    .select({ id: recipes.id, name: translations.value })
    .from(recipes)
    .leftJoin(
      translations,
      and(
        eq(translations.entityType, "recipe_name"),
        eq(translations.entityId, recipes.id),
        eq(translations.locale, "en")
      )
    )
    .where(ne(recipes.id, id))
    .orderBy(recipes.id);

  // Cooking steps
  const cookingStepsData = await db
    .select()
    .from(recipeCookingStep)
    .where(eq(recipeCookingStep.recipeId, id))
    .orderBy(recipeCookingStep.sortOrder);

  // TLDR steps
  const tldrStepsData = await db
    .select()
    .from(recipeTldrStep)
    .where(eq(recipeTldrStep.recipeId, id))
    .orderBy(recipeTldrStep.sortOrder);

  // Step ingredients
  const stepIngredientsData = cookingStepsData.length > 0
    ? await db
        .select()
        .from(cookingStepIngredient)
        .where(eq(cookingStepIngredient.recipeId, id))
        .orderBy(cookingStepIngredient.sortOrder)
    : [];

  // Step tags
  const stepTagsData = cookingStepsData.length > 0
    ? await db
        .select()
        .from(cookingStepTag)
        .where(eq(cookingStepTag.recipeId, id))
    : [];

  // Translations for both cooking and TLDR steps
  const cookingStepIds = cookingStepsData.map((s) => s.step);
  const tldrStepIds = tldrStepsData.map((s) => s.stepId);

  let cookingStepTranslations: typeof recipeTranslations = [];
  if (cookingStepIds.length > 0) {
    cookingStepTranslations = await db
      .select()
      .from(translations)
      .where(
        and(
          inArray(translations.entityId, cookingStepIds),
          inArray(translations.entityType, ["step_title", "step_description"])
        )
      );
  }

  let tldrStepTranslations: typeof recipeTranslations = [];
  if (tldrStepIds.length > 0) {
    tldrStepTranslations = await db
      .select()
      .from(translations)
      .where(
        and(
          inArray(translations.entityId, tldrStepIds),
          eq(translations.entityType, "tldr_step")
        )
      );
  }

  const getCookingStepTr = (stepId: string, locale: string, type: string) =>
    cookingStepTranslations.find(
      (t) => t.entityId === stepId && t.locale === locale && t.entityType === type
    )?.value ?? "";

  const getTldrStepTr = (stepId: string, locale: string) =>
    tldrStepTranslations.find(
      (t) => t.entityId === stepId && t.locale === locale
    )?.value ?? "";

  return (
    <RecipeEditor
      recipe={{
        id: recipe.id,
        image: recipe.image,
        timeMinutes: recipe.timeMinutes,
        difficulty: recipe.difficulty,
        isEnabled: recipe.isEnabled === 1,
        isBatch: recipe.isBatch === 1,
        isModerated: recipe.isModerated === 1,
        sourceUrl: recipe.sourceUrl,
        basePortions: recipe.basePortions,
        portionType: recipe.portionType as PortionType,
        nameEn: getTr("en", "recipe_name"),
        nameUa: getTr("ua", "recipe_name"),
        summaryEn: getTr("en", "recipe_summary"),
        summaryUa: getTr("ua", "recipe_summary"),
        tagIds: currentTagIds,
        allTags: allTagsData,
        allStepTags: allStepTagsData,
        kitchenItemIds: currentKitchenItemIds,
        allKitchenItems: allKitchenItemsData,
        ingredients: recipeIngredients.map((ri) => ({
          ingredientId: ri.ingredientId,
          name: ingredientMap[ri.ingredientId]?.name ?? ri.ingredientId,
          category: ingredientMap[ri.ingredientId]?.category ?? "",
          sortOrder: ri.sortOrder,
          quantity: ri.quantity,
          unit: ri.unit,
          optional: ri.optional === 1,
          portionCoefficient: ri.portionCoefficient ?? 1,
          substitutes: substitutesMap[ri.ingredientId] ?? [],
        })),
        allIngredients: allIngredientsData.map((i) => ({
          id: i.id,
          name: i.name ?? i.id,
          category: i.category,
          measurement: i.measurement,
        })),
        cookingSteps: cookingStepsData.map((s) => ({
          step: s.step,
          sortOrder: s.sortOrder,
          duration: s.duration,
          showTimer: s.showTimer === 1,
          image: s.image,
          titleEn: getCookingStepTr(s.step, "en", "step_title"),
          titleUa: getCookingStepTr(s.step, "ua", "step_title"),
          descriptionEn: getCookingStepTr(s.step, "en", "step_description"),
          descriptionUa: getCookingStepTr(s.step, "ua", "step_description"),
          stepIngredients: stepIngredientsData
            .filter((si) => si.step === s.step)
            .map((si) => ({
              ingredientId: si.ingredientId,
              quantity: si.quantity,
              unit: si.unit,
              sortOrder: si.sortOrder,
            })),
          tagIds: stepTagsData.filter((st) => st.step === s.step).map((st) => st.tag),
        })),
        tldrSteps: tldrStepsData.map((s) => ({
          stepId: s.stepId,
          sortOrder: s.sortOrder,
          minutes: s.minutes,
          titleEn: getTldrStepTr(s.stepId, "en"),
          titleUa: getTldrStepTr(s.stepId, "ua"),
        })),
        variationIds,
        allRecipes: allRecipesData.map((r) => ({ id: r.id, name: r.name ?? r.id })),
      }}
    />
  );
}
