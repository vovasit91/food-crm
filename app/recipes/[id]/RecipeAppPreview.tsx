"use client";

import { useState } from "react";

type IngredientMeta = {
  id: string;
  measurement: string;
  gInMeasurement: number | null;
  mlInMeasurement: number | null;
};

type PreviewIngredient = {
  ingredientId: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  portionCoefficient: number;
  optional: boolean;
};

type Props = {
  ingredients: PreviewIngredient[];
  ingredientMeta: Record<string, IngredientMeta>;
  unitLabels: Record<string, string>;
  basePortions: number;
  portionType: "portion" | "piece";
};

// --- Ported verbatim from the app (Food/src/services/recipes.ts) so the
// --- preview line matches exactly how ingredients render on the device.
const ML_PER_UNIT: Record<string, number> = { ml: 1, tsp: 5, tbsp: 15, cup: 240 };

function toGrams(
  quantity: number,
  recipeUnit: string,
  ingMeasurement: string,
  gInMeasurement: number | null,
  mlInMeasurement: number | null
): number | null {
  const effectiveG = gInMeasurement ?? (ingMeasurement === "g" ? 1 : null);
  if (effectiveG == null) return null;

  const mlPerRecipeUnit = ML_PER_UNIT[recipeUnit];
  const mlPerIngUnit = mlInMeasurement ?? ML_PER_UNIT[ingMeasurement];

  if (mlPerRecipeUnit != null && mlPerIngUnit != null) {
    return quantity * (mlPerRecipeUnit / mlPerIngUnit) * effectiveG;
  }
  if (recipeUnit === ingMeasurement) return quantity * effectiveG;
  return null;
}

function roundQuantity(quantity: number, unit: string | null): number {
  if (unit === "g" || unit === "ml") {
    if (quantity > 20) return Math.round(quantity / 10) * 10;
    if (quantity >= 5) return Math.round(quantity / 5) * 5;
    return Math.round(quantity * 10) / 10;
  }
  if (unit === "tbsp" || unit === "tsp") {
    if (quantity <= 0.4) return quantity;
    return Math.round(quantity * 2) / 2;
  }
  return Math.round(quantity * 10) / 10;
}

function composeLine(
  ing: PreviewIngredient,
  meta: IngredientMeta | undefined,
  unitLabels: Record<string, string>,
  persons: number
): string {
  const unitLabel = (key: string) => unitLabels[key] ?? key;
  const scale = persons * (ing.portionCoefficient ?? 1);
  const scaledQuantity =
    ing.quantity != null ? Math.round(ing.quantity * scale * 10) / 10 : null;
  const unitKey = ing.unit || meta?.measurement || null;
  const displayQuantity =
    scaledQuantity != null ? roundQuantity(scaledQuantity, unitKey) : null;

  const gramEquivalent =
    displayQuantity != null &&
    unitKey != null &&
    unitKey !== "g" &&
    unitKey !== "ml" &&
    meta != null
      ? toGrams(
          displayQuantity,
          unitKey,
          meta.measurement,
          meta.gInMeasurement,
          meta.mlInMeasurement
        )
      : null;
  const roundedGrams = gramEquivalent != null ? roundQuantity(gramEquivalent, "g") : null;

  const parts = [
    ing.name,
    displayQuantity != null ? String(displayQuantity) : null,
    displayQuantity != null && unitKey ? unitLabel(unitKey) : null,
    roundedGrams != null ? `(${roundedGrams} ${unitLabel("g")})` : null,
  ].filter(Boolean);
  return parts.join(" ");
}

function ShoppingBagIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 2l-2 5h16l-2-5H6z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="4" y="7" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M9 11a3 3 0 0 0 6 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export default function RecipeAppPreview({
  ingredients,
  ingredientMeta,
  unitLabels,
  basePortions,
  portionType,
}: Props) {
  const [persons, setPersons] = useState(Math.max(1, basePortions));

  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
          App preview
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPersons((p) => Math.max(1, p - 1))}
            className="flex h-6 w-6 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-600 hover:bg-gray-100"
            aria-label="Decrease portions"
          >
            −
          </button>
          <span className="min-w-[4.5rem] text-center text-xs font-medium text-gray-600">
            {persons} {portionType === "piece" ? "pcs" : persons === 1 ? "person" : "people"}
          </span>
          <button
            onClick={() => setPersons((p) => p + 1)}
            className="flex h-6 w-6 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-600 hover:bg-gray-100"
            aria-label="Increase portions"
          >
            +
          </button>
        </div>
      </div>

      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-base font-bold text-gray-900">Ingredients</h3>
        <span className="rounded-full bg-gray-200 px-2.5 py-0.5 text-xs font-medium text-gray-600">
          {ingredients.length} items
        </span>
      </div>

      {ingredients.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-400">No ingredients yet</p>
      ) : (
        <ul className="space-y-2">
          {ingredients.map((ing) => (
            <li
              key={ing.ingredientId}
              className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white px-3 py-2.5 shadow-sm"
            >
              <span
                className="h-8 w-8 shrink-0 rounded-md border-[1.5px] border-gray-300 bg-white"
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-gray-900">
                  {composeLine(ing, ingredientMeta[ing.ingredientId], unitLabels, persons)}
                  {ing.optional && (
                    <span className="ml-1 text-xs font-normal text-gray-400">(optional)</span>
                  )}
                </p>
                <p className="text-xs text-gray-400">Out of stock</p>
              </div>
              <span className="shrink-0 text-gray-400">
                <ShoppingBagIcon />
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
