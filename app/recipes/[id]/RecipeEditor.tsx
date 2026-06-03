"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import ImageUploader from "@/app/components/ImageUploader";
import { uploadImage } from "@/app/lib/upload";
import {
  updateRecipeBasic,
  updateRecipeCookingSteps,
  updateRecipeIngredients,
  updateRecipeKitchenItems,
  updateRecipeTags,
  updateRecipeTldrSteps,
  upsertTranslations,
  deleteRecipe,
} from "@/app/actions/recipes";

type IngredientRow = {
  ingredientId: string;
  name: string;
  category: string;
  sortOrder: number;
  quantity: number | null;
  unit: string | null;
  optional: boolean;
  portionCoefficient: number;
};

type TldrStepRow = {
  stepId: string;
  sortOrder: number;
  minutes: number;
  titleEn: string;
  titleUa: string;
};

type StepIngredientRow = {
  ingredientId: string;
  quantity: number | null;
  unit: string | null;
  sortOrder: number;
};

type CookingStepRow = {
  step: string;
  sortOrder: number;
  duration: number;
  showTimer: boolean;
  image: string | null;
  titleEn: string;
  titleUa: string;
  descriptionEn: string;
  descriptionUa: string;
  stepIngredients: StepIngredientRow[];
  tagIds: string[];
};

type RecipeProps = {
  id: string;
  image: string;
  timeMinutes: number;
  difficulty: string;
  isEnabled: boolean;
  nameEn: string;
  nameUa: string;
  summaryEn: string;
  summaryUa: string;
  tagIds: string[];
  allTags: { id: string; label: string }[];
  allStepTags: { id: string; label: string }[];
  kitchenItemIds: string[];
  allKitchenItems: { id: string }[];
  ingredients: IngredientRow[];
  allIngredients: { id: string; name: string; category: string; measurement: string }[];
  cookingSteps: CookingStepRow[];
  tldrSteps: TldrStepRow[];
};

type Tab = "basics" | "translations" | "tags" | "ingredients" | "tldr" | "steps";

const INPUT = "w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500";
const LABEL = "block text-xs font-medium text-gray-500 mb-1";
const SAVE_BTN = "px-4 py-2 bg-indigo-600 text-white text-sm rounded font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors";

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
        value ? "bg-indigo-600" : "bg-gray-300"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          value ? "translate-x-4" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

function swap<T>(arr: T[], i: number, j: number): T[] {
  const next = [...arr];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

export default function RecipeEditor({ recipe }: { recipe: RecipeProps }) {
  const [activeTab, setActiveTab] = useState<Tab>("basics");
  const [isPending, startTransition] = useTransition();
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  // Basics
  const [image, setImage] = useState(recipe.image);
  const [timeMinutes, setTimeMinutes] = useState(recipe.timeMinutes);
  const [difficulty, setDifficulty] = useState(recipe.difficulty);
  const [isEnabled, setIsEnabled] = useState(recipe.isEnabled);

  // Translations
  const [nameEn, setNameEn] = useState(recipe.nameEn);
  const [nameUa, setNameUa] = useState(recipe.nameUa);
  const [summaryEn, setSummaryEn] = useState(recipe.summaryEn);
  const [summaryUa, setSummaryUa] = useState(recipe.summaryUa);

  // Tags + Kitchen
  const [tagIds, setTagIds] = useState<string[]>(recipe.tagIds);
  const [kitchenItemIds, setKitchenItemIds] = useState<string[]>(recipe.kitchenItemIds);

  // Ingredients
  const [ingredients, setIngredients] = useState<IngredientRow[]>(recipe.ingredients);
  const [newIngredientId, setNewIngredientId] = useState("");

  // TLDR Steps
  const [tldrSteps, setTldrSteps] = useState<TldrStepRow[]>(recipe.tldrSteps);

  // Cooking Steps
  const [steps, setSteps] = useState<CookingStepRow[]>(recipe.cookingSteps);
  const [stepDragging, setStepDragging] = useState<number | null>(null);
  const [stepUploading, setStepUploading] = useState<number | null>(null);
  const [newStepIngIds, setNewStepIngIds] = useState<Record<string, string>>({});

  const showSaved = () => {
    setSavedMsg("Saved");
    setTimeout(() => setSavedMsg(null), 2000);
  };

  const save = (fn: () => Promise<void>) => {
    startTransition(async () => {
      await fn();
      showSaved();
    });
  };

  const addIngredient = () => {
    const found = recipe.allIngredients.find((i) => i.id === newIngredientId);
    if (!found || ingredients.some((i) => i.ingredientId === found.id)) return;
    setIngredients([
      ...ingredients,
      {
        ingredientId: found.id,
        name: found.name,
        category: found.category,
        sortOrder: ingredients.length,
        quantity: null,
        unit: null,
        optional: false,
        portionCoefficient: 1,
      },
    ]);
    setNewIngredientId("");
  };

  const updateIngredient = (index: number, patch: Partial<IngredientRow>) =>
    setIngredients(ingredients.map((x, i) => (i === index ? { ...x, ...patch } : x)));

  const updateStep = (index: number, patch: Partial<CookingStepRow>) =>
    setSteps(steps.map((x, i) => (i === index ? { ...x, ...patch } : x)));

  const handleStepDrop = async (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setStepDragging(null);
    const file = e.dataTransfer.files[0];
    if (!file || !file.type.startsWith("image/")) return;
    setStepUploading(index);
    try {
      const url = await uploadImage(file, "steps");
      updateStep(index, { image: url });
    } finally {
      setStepUploading(null);
    }
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: "basics", label: "Basics" },
    { id: "translations", label: "Translations" },
    { id: "tags", label: "Tags & Kitchen" },
    { id: "ingredients", label: `Ingredients (${ingredients.length})` },
    { id: "tldr", label: `TLDR (${tldrSteps.length})` },
    { id: "steps", label: `Steps (${steps.length})` },
  ];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/recipes" className="text-sm text-gray-400 hover:text-gray-600">
          Recipes
        </Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-lg font-semibold text-gray-900">{nameEn || recipe.id}</h1>
        {savedMsg && <span className="text-sm text-green-600 font-medium">{savedMsg}</span>}
        <button
          className="ml-auto px-3 py-1.5 text-sm font-medium text-red-600 border border-red-200 rounded hover:bg-red-50 transition-colors disabled:opacity-50"
          disabled={isPending}
          onClick={() => {
            if (confirm(`Delete "${nameEn || recipe.id}"? This cannot be undone.`)) {
              startTransition(() => deleteRecipe(recipe.id));
            }
          }}
        >
          Delete
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6 gap-1">
        {tabs.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === id
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* --- Basics --- */}
      {activeTab === "basics" && (
        <div className="space-y-4">
          <div>
            <label className={LABEL}>Image</label>
            <ImageUploader value={image} onChange={setImage} folder="recipes" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL}>Time (minutes)</label>
              <input
                type="number"
                className={INPUT}
                value={timeMinutes}
                onChange={(e) => setTimeMinutes(Number(e.target.value))}
              />
            </div>
            <div>
              <label className={LABEL}>Difficulty</label>
              <select
                className={INPUT}
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={LABEL + " mb-0"}>Enabled</span>
            <Toggle value={isEnabled} onChange={setIsEnabled} />
          </div>
          <button
            className={SAVE_BTN}
            disabled={isPending}
            onClick={() =>
              save(() => updateRecipeBasic(recipe.id, { image, timeMinutes, difficulty, isEnabled }))
            }
          >
            {isPending ? "Saving..." : "Save"}
          </button>
        </div>
      )}

      {/* --- Translations --- */}
      {activeTab === "translations" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL}>Name (EN)</label>
              <input className={INPUT} value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
            </div>
            <div>
              <label className={LABEL}>Name (UA)</label>
              <input className={INPUT} value={nameUa} onChange={(e) => setNameUa(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL}>Summary (EN)</label>
              <textarea
                className={INPUT + " h-40 resize-none"}
                value={summaryEn}
                onChange={(e) => setSummaryEn(e.target.value)}
              />
            </div>
            <div>
              <label className={LABEL}>Summary (UA)</label>
              <textarea
                className={INPUT + " h-40 resize-none"}
                value={summaryUa}
                onChange={(e) => setSummaryUa(e.target.value)}
              />
            </div>
          </div>
          <button
            className={SAVE_BTN}
            disabled={isPending}
            onClick={() =>
              save(() =>
                upsertTranslations([
                  { locale: "en", entityType: "recipe_name", entityId: recipe.id, value: nameEn },
                  { locale: "ua", entityType: "recipe_name", entityId: recipe.id, value: nameUa },
                  { locale: "en", entityType: "recipe_summary", entityId: recipe.id, value: summaryEn },
                  { locale: "ua", entityType: "recipe_summary", entityId: recipe.id, value: summaryUa },
                ])
              )
            }
          >
            {isPending ? "Saving..." : "Save"}
          </button>
        </div>
      )}

      {/* --- Tags & Kitchen --- */}
      {activeTab === "tags" && (
        <div className="space-y-8">
          <section>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Tags</h3>
            <div className="grid grid-cols-3 gap-2">
              {recipe.allTags.map((tag) => (
                <label key={tag.id} className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={tagIds.includes(tag.id)}
                    onChange={(e) =>
                      setTagIds(
                        e.target.checked ? [...tagIds, tag.id] : tagIds.filter((t) => t !== tag.id)
                      )
                    }
                    className="rounded border-gray-300 accent-indigo-600"
                  />
                  <span className="text-sm text-gray-700">{tag.label}</span>
                </label>
              ))}
            </div>
            <button
              className={SAVE_BTN + " mt-4"}
              disabled={isPending}
              onClick={() => save(() => updateRecipeTags(recipe.id, tagIds))}
            >
              {isPending ? "Saving..." : "Save Tags"}
            </button>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Kitchen Items</h3>
            <div className="grid grid-cols-3 gap-2">
              {recipe.allKitchenItems.map((item) => (
                <label key={item.id} className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={kitchenItemIds.includes(item.id)}
                    onChange={(e) =>
                      setKitchenItemIds(
                        e.target.checked
                          ? [...kitchenItemIds, item.id]
                          : kitchenItemIds.filter((k) => k !== item.id)
                      )
                    }
                    className="rounded border-gray-300 accent-indigo-600"
                  />
                  <span className="text-sm text-gray-700">{item.id}</span>
                </label>
              ))}
            </div>
            <button
              className={SAVE_BTN + " mt-4"}
              disabled={isPending}
              onClick={() => save(() => updateRecipeKitchenItems(recipe.id, kitchenItemIds))}
            >
              {isPending ? "Saving..." : "Save Kitchen Items"}
            </button>
          </section>
        </div>
      )}

      {/* --- Ingredients --- */}
      {activeTab === "ingredients" && (
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-3 py-2 font-medium text-gray-500 text-left w-8" />
                  <th className="px-3 py-2 font-medium text-gray-500 text-left">Ingredient</th>
                  <th className="px-3 py-2 font-medium text-gray-500 text-left">Qty</th>
                  <th className="px-3 py-2 font-medium text-gray-500 text-left">Unit</th>
                  <th className="px-3 py-2 font-medium text-gray-500 text-center">Optional</th>
                  <th className="px-3 py-2 font-medium text-gray-500 text-left">Portion</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {ingredients.map((ing, i) => (
                  <tr key={ing.ingredientId} className="border-b border-gray-100">
                    <td className="px-2 py-2">
                      <div className="flex flex-col text-gray-400 text-xs leading-none gap-0.5">
                        <button
                          onClick={() => setIngredients(swap(ingredients, i, i - 1))}
                          disabled={i === 0}
                          className="disabled:opacity-20 hover:text-gray-700"
                        >
                          ↑
                        </button>
                        <button
                          onClick={() => setIngredients(swap(ingredients, i, i + 1))}
                          disabled={i === ingredients.length - 1}
                          className="disabled:opacity-20 hover:text-gray-700"
                        >
                          ↓
                        </button>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-medium text-gray-900">{ing.name}</div>
                      <div className="text-xs text-gray-400 font-mono">{ing.ingredientId}</div>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        className="w-20 border border-gray-300 rounded px-2 py-1 text-sm"
                        value={ing.quantity ?? ""}
                        onChange={(e) =>
                          updateIngredient(i, {
                            quantity: e.target.value !== "" ? Number(e.target.value) : null,
                          })
                        }
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        className="w-20 border border-gray-300 rounded px-2 py-1 text-sm"
                        value={ing.unit ?? ""}
                        onChange={(e) =>
                          updateIngredient(i, { unit: e.target.value || null })
                        }
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={ing.optional}
                        onChange={(e) => updateIngredient(i, { optional: e.target.checked })}
                        className="rounded border-gray-300 accent-indigo-600"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        className="w-16 border border-gray-300 rounded px-2 py-1 text-sm"
                        value={ing.portionCoefficient}
                        onChange={(e) =>
                          updateIngredient(i, { portionCoefficient: Number(e.target.value) })
                        }
                      />
                    </td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() =>
                          setIngredients(ingredients.filter((_, j) => j !== i))
                        }
                        className="text-red-400 hover:text-red-600 text-xs font-medium"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-2">
            <select
              className="flex-1 border border-gray-300 rounded px-3 py-1.5 text-sm"
              value={newIngredientId}
              onChange={(e) => setNewIngredientId(e.target.value)}
            >
              <option value="">Add ingredient...</option>
              {recipe.allIngredients
                .filter((i) => !ingredients.some((x) => x.ingredientId === i.id))
                .map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name} ({i.id})
                  </option>
                ))}
            </select>
            <button
              onClick={addIngredient}
              disabled={!newIngredientId}
              className="px-3 py-1.5 bg-gray-100 border border-gray-300 text-sm rounded hover:bg-gray-200 disabled:opacity-50"
            >
              Add
            </button>
          </div>

          <button
            className={SAVE_BTN}
            disabled={isPending}
            onClick={() =>
              save(() =>
                updateRecipeIngredients(
                  recipe.id,
                  ingredients.map((ing, i) => ({ ...ing, sortOrder: i }))
                )
              )
            }
          >
            {isPending ? "Saving..." : "Save Ingredients"}
          </button>
        </div>
      )}

      {/* --- TLDR Steps --- */}
      {activeTab === "tldr" && (
        <div className="space-y-3">
          {tldrSteps.map((step, i) => (
            <div key={step.stepId} className="border border-gray-200 rounded-lg p-4 bg-white">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1 text-gray-400 text-xs">
                    <button
                      onClick={() => setTldrSteps(swap(tldrSteps, i, i - 1))}
                      disabled={i === 0}
                      className="disabled:opacity-20 hover:text-gray-700"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => setTldrSteps(swap(tldrSteps, i, i + 1))}
                      disabled={i === tldrSteps.length - 1}
                      className="disabled:opacity-20 hover:text-gray-700"
                    >
                      ↓
                    </button>
                  </div>
                  <span className="text-xs font-mono text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                    {step.stepId}
                  </span>
                </div>
                <button
                  onClick={() => setTldrSteps(tldrSteps.filter((_, j) => j !== i))}
                  className="text-red-400 hover:text-red-600 text-xs font-medium"
                >
                  Remove
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className={LABEL}>Title (EN)</label>
                  <input
                    className={INPUT}
                    value={step.titleEn}
                    onChange={(e) =>
                      setTldrSteps(tldrSteps.map((s, j) => j === i ? { ...s, titleEn: e.target.value } : s))
                    }
                  />
                </div>
                <div>
                  <label className={LABEL}>Title (UA)</label>
                  <input
                    className={INPUT}
                    value={step.titleUa}
                    onChange={(e) =>
                      setTldrSteps(tldrSteps.map((s, j) => j === i ? { ...s, titleUa: e.target.value } : s))
                    }
                  />
                </div>
              </div>

              <div>
                <label className={LABEL}>Minutes</label>
                <input
                  type="number"
                  className="w-24 border border-gray-300 rounded px-2 py-1.5 text-sm"
                  value={step.minutes}
                  onChange={(e) =>
                    setTldrSteps(tldrSteps.map((s, j) => j === i ? { ...s, minutes: Number(e.target.value) } : s))
                  }
                />
              </div>
            </div>
          ))}

          <div className="flex gap-3 pt-1">
            <button
              onClick={() =>
                setTldrSteps([
                  ...tldrSteps,
                  {
                    stepId: `tldr-step-${Date.now()}-${recipe.id}`,
                    sortOrder: tldrSteps.length,
                    minutes: 1,
                    titleEn: "",
                    titleUa: "",
                  },
                ])
              }
              className="px-3 py-1.5 bg-gray-100 border border-gray-300 text-sm rounded hover:bg-gray-200"
            >
              + Add Step
            </button>
            <button
              className={SAVE_BTN}
              disabled={isPending}
              onClick={() =>
                save(() =>
                  updateRecipeTldrSteps(
                    recipe.id,
                    tldrSteps.map((s, i) => ({ ...s, sortOrder: i }))
                  )
                )
              }
            >
              {isPending ? "Saving..." : "Save TLDR Steps"}
            </button>
          </div>
        </div>
      )}

      {/* --- Cooking Steps --- */}
      {activeTab === "steps" && (
        <div className="space-y-3">
          {steps.map((step, i) => (
            <div
              key={step.step}
              className={`border rounded-lg p-4 bg-white transition-colors ${
                stepDragging === i
                  ? "border-indigo-400 bg-indigo-50"
                  : "border-gray-200"
              }`}
              onDragOver={(e) => { e.preventDefault(); setStepDragging(i); }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setStepDragging(null);
              }}
              onDrop={(e) => handleStepDrop(e, i)}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1 text-gray-400 text-xs">
                    <button
                      onClick={() => setSteps(swap(steps, i, i - 1))}
                      disabled={i === 0}
                      className="disabled:opacity-20 hover:text-gray-700"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => setSteps(swap(steps, i, i + 1))}
                      disabled={i === steps.length - 1}
                      className="disabled:opacity-20 hover:text-gray-700"
                    >
                      ↓
                    </button>
                  </div>
                  <span className="text-sm font-semibold text-gray-500 w-5 text-center">{i + 1}</span>
                  <span className="text-xs font-mono text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                    {step.step}
                  </span>
                </div>
                <button
                  onClick={() => setSteps(steps.filter((_, j) => j !== i))}
                  className="text-red-400 hover:text-red-600 text-xs font-medium"
                >
                  Remove
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className={LABEL}>Title (EN)</label>
                  <input
                    className={INPUT}
                    value={step.titleEn}
                    onChange={(e) => updateStep(i, { titleEn: e.target.value })}
                  />
                </div>
                <div>
                  <label className={LABEL}>Title (UA)</label>
                  <input
                    className={INPUT}
                    value={step.titleUa}
                    onChange={(e) => updateStep(i, { titleUa: e.target.value })}
                  />
                </div>
                <div>
                  <label className={LABEL}>Description (EN)</label>
                  <textarea
                    className={INPUT + " h-16 resize-none"}
                    value={step.descriptionEn}
                    onChange={(e) => updateStep(i, { descriptionEn: e.target.value })}
                  />
                </div>
                <div>
                  <label className={LABEL}>Description (UA)</label>
                  <textarea
                    className={INPUT + " h-16 resize-none"}
                    value={step.descriptionUa}
                    onChange={(e) => updateStep(i, { descriptionUa: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex items-end gap-4">
                <div>
                  <label className={LABEL}>Duration (min)</label>
                  <input
                    type="number"
                    className="w-24 border border-gray-300 rounded px-2 py-1.5 text-sm"
                    value={step.duration}
                    onChange={(e) => updateStep(i, { duration: Number(e.target.value) })}
                  />
                </div>
                <div className="flex items-center gap-2 pb-1">
                  <span className={LABEL + " mb-0"}>Timer</span>
                  <Toggle
                    value={step.showTimer}
                    onChange={(v) => updateStep(i, { showTimer: v })}
                  />
                </div>
                <div className="flex-1">
                  <label className={LABEL}>Image</label>
                  {stepUploading === i ? (
                    <p className="text-xs text-indigo-500">Uploading...</p>
                  ) : (
                    <ImageUploader
                      value={step.image}
                      onChange={(url) => updateStep(i, { image: url || null })}
                      folder="steps"
                    />
                  )}
                </div>
              </div>

              {recipe.allStepTags.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <label className={LABEL}>Step Tags</label>
                  <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                    {recipe.allStepTags.map((tag) => (
                      <label key={tag.id} className="flex items-center gap-1.5 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={step.tagIds.includes(tag.id)}
                          onChange={(e) =>
                            updateStep(i, {
                              tagIds: e.target.checked
                                ? [...step.tagIds, tag.id]
                                : step.tagIds.filter((t) => t !== tag.id),
                            })
                          }
                          className="rounded border-gray-300 accent-indigo-600"
                        />
                        <span className="text-sm text-gray-700">{tag.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-3 pt-3 border-t border-gray-100">
                <label className={LABEL}>Step Ingredients</label>
                {step.stepIngredients.length > 0 && (
                  <div className="space-y-1.5 mb-2">
                    {step.stepIngredients.map((si, j) => (
                      <div key={si.ingredientId} className="flex items-center gap-2">
                        <span className="text-sm text-gray-700 flex-1">
                          {recipe.allIngredients.find((x) => x.id === si.ingredientId)?.name ?? si.ingredientId}
                        </span>
                        <input
                          type="number"
                          className="w-16 border border-gray-300 rounded px-2 py-1 text-sm"
                          placeholder="Qty"
                          value={si.quantity ?? ""}
                          onChange={(e) =>
                            updateStep(i, {
                              stepIngredients: step.stepIngredients.map((x, k) =>
                                k === j ? { ...x, quantity: e.target.value !== "" ? Number(e.target.value) : null } : x
                              ),
                            })
                          }
                        />
                        <input
                          className="w-16 border border-gray-300 rounded px-2 py-1 text-sm"
                          placeholder="Unit"
                          value={si.unit ?? ""}
                          onChange={(e) =>
                            updateStep(i, {
                              stepIngredients: step.stepIngredients.map((x, k) =>
                                k === j ? { ...x, unit: e.target.value || null } : x
                              ),
                            })
                          }
                        />
                        <button
                          onClick={() =>
                            updateStep(i, {
                              stepIngredients: step.stepIngredients.filter((_, k) => k !== j),
                            })
                          }
                          className="text-red-400 hover:text-red-600 text-xs font-medium"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <select
                    className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm"
                    value={newStepIngIds[step.step] ?? ""}
                    onChange={(e) => setNewStepIngIds((prev) => ({ ...prev, [step.step]: e.target.value }))}
                  >
                    <option value="">Add ingredient to step...</option>
                    {recipe.allIngredients
                      .filter((x) => !step.stepIngredients.some((si) => si.ingredientId === x.id))
                      .map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.name} ({x.id})
                        </option>
                      ))}
                  </select>
                  <button
                    onClick={() => {
                      const ingId = newStepIngIds[step.step];
                      if (!ingId) return;
                      updateStep(i, {
                        stepIngredients: [
                          ...step.stepIngredients,
                          { ingredientId: ingId, quantity: null, unit: null, sortOrder: step.stepIngredients.length },
                        ],
                      });
                      setNewStepIngIds((prev) => ({ ...prev, [step.step]: "" }));
                    }}
                    disabled={!newStepIngIds[step.step]}
                    className="px-3 py-1 bg-gray-100 border border-gray-300 text-sm rounded hover:bg-gray-200 disabled:opacity-50"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          ))}

          <div className="flex gap-3 pt-1">
            <button
              onClick={() =>
                setSteps([
                  ...steps,
                  {
                    step: `step-${Date.now()}-${recipe.id}`,
                    sortOrder: steps.length,
                    duration: 0,
                    showTimer: false,
                    image: null,
                    titleEn: "",
                    titleUa: "",
                    descriptionEn: "",
                    descriptionUa: "",
                    stepIngredients: [],
                    tagIds: [],
                  },
                ])
              }
              className="px-3 py-1.5 bg-gray-100 border border-gray-300 text-sm rounded hover:bg-gray-200"
            >
              + Add Step
            </button>
            <button
              className={SAVE_BTN}
              disabled={isPending}
              onClick={() =>
                save(() =>
                  updateRecipeCookingSteps(
                    recipe.id,
                    steps.map((s, i) => ({ ...s, sortOrder: i }))
                  )
                )
              }
            >
              {isPending ? "Saving..." : "Save Steps"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
