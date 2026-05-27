import { db } from "@/db";
import { tags, translations } from "@/db/generated/schema";
import { and, eq } from "drizzle-orm";
import Icon from "@/app/components/Icon";

export const dynamic = "force-dynamic";

export default async function TagsPage() {
  const data = await db
    .select({
      id: tags.id,
      label: tags.label,
      icon: tags.icon,
      nameUa: translations.value,
    })
    .from(tags)
    .leftJoin(
      translations,
      and(
        eq(translations.entityType, "tag"),
        eq(translations.entityId, tags.id),
        eq(translations.locale, "ua")
      )
    )
    .orderBy(tags.id);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Tags</h1>
        <span className="text-sm text-gray-400">{data.length} total</span>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-500">ID</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Label (EN)</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Label (UA)</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Icon</th>
            </tr>
          </thead>
          <tbody>
            {data.map((tag) => (
              <tr key={tag.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs text-gray-500">{tag.id}</td>
                <td className="px-4 py-3 font-medium text-gray-900">{tag.label}</td>
                <td className="px-4 py-3 text-gray-600">{tag.nameUa ?? "—"}</td>
                <td className="px-4 py-3 text-gray-600">
                  <Icon name={tag.icon} size={18} className="text-gray-600" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
