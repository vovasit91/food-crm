import { db } from "@/db";
import { kitchenItems, translations } from "@/db/generated/schema";
import { and, eq } from "drizzle-orm";
import Icon from "@/app/components/Icon";

export const dynamic = "force-dynamic";

export default async function KitchenItemsPage() {
  const data = await db
    .select({
      id: kitchenItems.id,
      icon: kitchenItems.icon,
      nameEn: translations.value,
    })
    .from(kitchenItems)
    .leftJoin(
      translations,
      and(
        eq(translations.entityType, "kitchen_item"),
        eq(translations.entityId, kitchenItems.id),
        eq(translations.locale, "en")
      )
    )
    .orderBy(kitchenItems.id);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Kitchen Items</h1>
        <span className="text-sm text-gray-400">{data.length} total</span>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-500">ID</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Name</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Icon</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item) => (
              <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs text-gray-500">{item.id}</td>
                <td className="px-4 py-3 font-medium text-gray-900">{item.nameEn || item.id}</td>
                <td className="px-4 py-3 text-gray-600">
                  <Icon name={item.icon} size={18} className="text-gray-600" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
