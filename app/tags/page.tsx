import { db } from "@/db";
import { tags, translations } from "@/db/generated/schema";
import { and, eq, inArray, isNull } from "drizzle-orm";
import Icon from "@/app/components/Icon";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function TagsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type } = await searchParams;

  const allTypes = await db
    .selectDistinct({ type: tags.type })
    .from(tags)
    .orderBy(tags.type);

  const query = db
    .select({
      id: tags.id,
      label: tags.label,
      icon: tags.icon,
      type: tags.type,
      nameUk: translations.value,
    })
    .from(tags)
    .leftJoin(
      translations,
      and(
        inArray(translations.entityType, ["tag", "cooking_tag"]),
        eq(translations.entityId, tags.id),
        eq(translations.locale, "uk")
      )
    )
    .orderBy(tags.id);

  const data = type
    ? await query.where(type === "null" ? isNull(tags.type) : eq(tags.type, type))
    : await query;

  const types = allTypes.map((r) => r.type);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Tags</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400">{data.length} total</span>
          <Link
            href="/tags/new"
            className="px-3 py-1.5 bg-indigo-600 text-white text-sm rounded font-medium hover:bg-indigo-700 transition-colors"
          >
            + New Tag
          </Link>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <Link
          href="/tags"
          className={`px-3 py-1.5 rounded text-sm font-medium border transition-colors ${
            !type
              ? "bg-indigo-600 text-white border-indigo-600"
              : "bg-white text-gray-600 border-gray-300 hover:border-gray-400"
          }`}
        >
          All
        </Link>
        {types.map((t) => (
          <Link
            key={t ?? "null"}
            href={`/tags?type=${t ?? "null"}`}
            className={`px-3 py-1.5 rounded text-sm font-medium border transition-colors ${
              type === (t ?? "null")
                ? "bg-indigo-600 text-white border-indigo-600"
                : "bg-white text-gray-600 border-gray-300 hover:border-gray-400"
            }`}
          >
            {t ?? "—"}
          </Link>
        ))}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-500">ID</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Label (EN)</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Label (UK)</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Type</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Icon</th>
            </tr>
          </thead>
          <tbody>
            {data.map((tag) => (
              <tr key={tag.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs text-gray-500">
                  <Link href={`/tags/${tag.id}`} className="hover:text-indigo-600">{tag.id}</Link>
                </td>
                <td className="px-4 py-3 font-medium text-gray-900">{tag.label}</td>
                <td className="px-4 py-3 text-gray-600">{tag.nameUk ?? "—"}</td>
                <td className="px-4 py-3 text-gray-500 font-mono text-xs">{tag.type ?? "—"}</td>
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
