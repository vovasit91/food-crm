"use client";

import { useState } from "react";
import { importSingleRecipe, bumpVersion } from "@/app/actions/import";
import type { ImportRecipe, ImportResult } from "@/lib/import-recipes";

export default function ImportPage() {
  const [json, setJson] = useState("");
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [isPending, setIsPending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPending(true);
    setResult(null);
    setProgress(null);

    let recipes: ImportRecipe[];
    try {
      const parsed = JSON.parse(json);
      recipes = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      setResult({ recipesInserted: 0, recipesSkipped: 0, ingredientsInserted: 0, errors: ["Invalid JSON"] });
      setIsPending(false);
      return;
    }

    const totals: ImportResult = { recipesInserted: 0, recipesSkipped: 0, ingredientsInserted: 0, errors: [] };
    setProgress({ current: 0, total: recipes.length });

    for (let i = 0; i < recipes.length; i++) {
      const r = await importSingleRecipe(recipes[i]);
      totals.recipesInserted += r.recipesInserted;
      totals.recipesSkipped += r.recipesSkipped;
      totals.ingredientsInserted += r.ingredientsInserted;
      totals.errors.push(...r.errors);
      setProgress({ current: i + 1, total: recipes.length });
    }

    if (totals.recipesInserted > 0) await bumpVersion();

    setResult(totals);
    setIsPending(false);
  };

  const progressPct = progress ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-xl font-semibold mb-6">Import from JSON</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <textarea
          value={json}
          onChange={(e) => setJson(e.target.value)}
          rows={16}
          placeholder={'[{ "id": "recipe-id", ... }]'}
          className="w-full font-mono text-xs border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button
          type="submit"
          disabled={isPending || !json.trim()}
          className="px-4 py-2 rounded text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
        >
          {isPending ? "Importing…" : "Import"}
        </button>
      </form>

      {progress && (
        <div className="mt-6 space-y-1.5">
          <div className="flex justify-between text-xs text-gray-500">
            <span>{progress.current} / {progress.total}</span>
            <span>{progressPct}%</span>
          </div>
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-600 rounded-full transition-all duration-200"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      {result && (
        <div className="mt-6 rounded border border-gray-200 p-4 space-y-2 text-sm">
          <p className="font-medium">Result</p>
          <ul className="space-y-1 text-gray-700">
            <li>Recipes inserted: <span className="font-medium text-green-700">{result.recipesInserted}</span></li>
            <li>Recipes skipped (already exist): <span className="font-medium text-gray-500">{result.recipesSkipped}</span></li>
            <li>Ingredients inserted: <span className="font-medium text-green-700">{result.ingredientsInserted}</span></li>
          </ul>
          {result.errors.length > 0 && (
            <div className="mt-3">
              <p className="font-medium text-red-600">Errors</p>
              <ul className="mt-1 space-y-1 text-red-700">
                {result.errors.map((err, i) => (
                  <li key={i} className="font-mono text-xs">{err}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
