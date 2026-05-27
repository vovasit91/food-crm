import { db } from "@/db";
import { categories, translations } from "@/db/generated/schema";
import { and, eq } from "drizzle-orm";
import Icon from "@/app/components/Icon";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const data = await db
    .select({
      id: categories.id,
      enabled: categories.enabled,
      icon: categories.icon,
      nameEn: translations.value,
    })
    .from(categories)
    .leftJoin(
      translations,
      and(
        eq(translations.entityType, "category"),
        eq(translations.entityId, categories.id),
        eq(translations.locale, "en")
      )
    )
    .orderBy(categories.id);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Categories</h1>
        <span className="text-sm text-gray-400">{data.length} total</span>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-500">ID</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Name</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Icon</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
            </tr>
          </thead>
          <tbody>
            {data.map((cat) => (
              <tr key={cat.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs text-gray-500">{cat.id}</td>
                <td className="px-4 py-3 font-medium text-gray-900">{cat.nameEn || cat.id}</td>
                <td className="px-4 py-3 text-gray-600">
                  <Icon name={cat.icon} size={18} className="text-gray-600" />
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block w-2 h-2 rounded-full mr-2 ${
                      cat.enabled ? "bg-green-500" : "bg-gray-300"
                    }`}
                  />
                  <span className="text-gray-600">{cat.enabled ? "Enabled" : "Disabled"}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
