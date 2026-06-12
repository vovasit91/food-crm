import { db } from "@/db";
import { ingredients, translations } from "@/db/generated/schema";
import { and, eq } from "drizzle-orm";
import Icon from "@/app/components/Icon";

export const dynamic = "force-dynamic";

export default async function IngredientsPage() {
  const data = await db
    .select({
      id: ingredients.id,
      icon: ingredients.icon,
      category: ingredients.category,
      measurement: ingredients.measurement,
      proteins: ingredients.proteins,
      carbs: ingredients.carbs,
      fats: ingredients.fats,
      gInMeasurement: ingredients.gInMeasurement,
      isBasic: ingredients.isBasic,
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
    .orderBy(ingredients.category, ingredients.id);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Ingredients</h1>
        <span className="text-sm text-gray-400">{data.length} total</span>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 font-medium text-gray-500 w-8" />
              <th className="text-left px-4 py-3 font-medium text-gray-500">Name</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Category</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Measurement</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">Protein</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">Carbs</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">Fat</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">g/unit</th>
              <th className="text-center px-4 py-3 font-medium text-gray-500">Basic</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item) => (
              <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-500">
                  <Icon name={item.icon} size={18} className="text-gray-500" />
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900">{item.name || item.id}</div>
                  <div className="text-xs text-gray-400 font-mono">{item.id}</div>
                </td>
                <td className="px-4 py-3 text-gray-600">{item.category}</td>
                <td className="px-4 py-3 text-gray-600">{item.measurement}</td>
                <td className="px-4 py-3 text-right text-gray-600">{item.proteins ?? "—"}</td>
                <td className="px-4 py-3 text-right text-gray-600">{item.carbs ?? "—"}</td>
                <td className="px-4 py-3 text-right text-gray-600">{item.fats ?? "—"}</td>
                <td className="px-4 py-3 text-right text-gray-600">{item.gInMeasurement ?? "—"}</td>
                <td className="px-4 py-3 text-center text-gray-600">{item.isBasic ? "✓" : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
