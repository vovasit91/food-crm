import { db } from "@/db";
import { recipes, translations } from "@/db/generated/schema";
import { and, count, eq } from "drizzle-orm";
import Link from "next/link";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export default async function RecipesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; moderated?: string; reparsing?: string }>;
}) {
  const { page: pageParam, moderated, reparsing } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const moderatedFilter =
    moderated === "1"
      ? eq(recipes.isModerated, 1)
      : moderated === "0"
        ? eq(recipes.isModerated, 0)
        : undefined;

  const reparsingFilter =
    reparsing === "1"
      ? eq(recipes.isForReparsing, 1)
      : reparsing === "0"
        ? eq(recipes.isForReparsing, 0)
        : undefined;

  const filter = and(moderatedFilter, reparsingFilter);

  const [data, [{ total }]] = await Promise.all([
    db
      .select({
        id: recipes.id,
        image: recipes.image,
        timeMinutes: recipes.timeMinutes,
        difficulty: recipes.difficulty,
        isEnabled: recipes.isEnabled,
        isModerated: recipes.isModerated,
        isForReparsing: recipes.isForReparsing,
        name: translations.value,
      })
      .from(recipes)
      .leftJoin(
        translations,
        and(
          eq(translations.entityType, "recipe_name"),
          eq(translations.entityId, recipes.id),
          eq(translations.locale, "en")
        )
      )
      .where(filter)
      .orderBy(recipes.id)
      .limit(PAGE_SIZE)
      .offset(offset),
    db.select({ total: count() }).from(recipes).where(filter),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const difficultyColor: Record<string, string> = {
    easy: "bg-green-100 text-green-700",
    medium: "bg-yellow-100 text-yellow-700",
    hard: "bg-red-100 text-red-700",
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Recipes</h1>
        <span className="text-sm text-gray-400">{total} total</span>
      </div>

      <div className="flex flex-col gap-2 mb-4">
        <div className="flex gap-2">
          {[
            { label: "All", value: undefined },
            { label: "Moderated", value: "1" },
            { label: "Pending", value: "0" },
          ].map((f) => {
            const params = new URLSearchParams();
            if (f.value) params.set("moderated", f.value);
            if (reparsing) params.set("reparsing", reparsing);
            const qs = params.toString();
            return (
              <Link
                key={f.label}
                href={qs ? `/recipes?${qs}` : "/recipes"}
                className={`px-3 py-1.5 rounded text-sm font-medium border transition-colors ${
                  (moderated ?? undefined) === f.value
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "bg-white text-gray-600 border-gray-300 hover:border-gray-400"
                }`}
              >
                {f.label}
              </Link>
            );
          })}
        </div>
        <div className="flex gap-2">
          {[
            { label: "All", value: undefined },
            { label: "For reparsing", value: "1" },
            { label: "Not for reparsing", value: "0" },
          ].map((f) => {
            const params = new URLSearchParams();
            if (moderated) params.set("moderated", moderated);
            if (f.value) params.set("reparsing", f.value);
            const qs = params.toString();
            return (
              <Link
                key={f.label}
                href={qs ? `/recipes?${qs}` : "/recipes"}
                className={`px-3 py-1.5 rounded text-sm font-medium border transition-colors ${
                  (reparsing ?? undefined) === f.value
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "bg-white text-gray-600 border-gray-300 hover:border-gray-400"
                }`}
              >
                {f.label}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Recipe</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Time</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Difficulty</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Moderated</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Reparsing</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {data.map((recipe) => (
              <tr key={recipe.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {recipe.image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={recipe.image}
                        alt=""
                        className="w-10 h-10 rounded object-cover shrink-0"
                      />
                    )}
                    <div>
                      <div className="font-medium text-gray-900">
                        {recipe.name || recipe.id}
                      </div>
                      <div className="text-xs text-gray-400 font-mono">{recipe.id}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-600">{recipe.timeMinutes} min</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                      difficultyColor[recipe.difficulty] ?? "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {recipe.difficulty}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block w-2 h-2 rounded-full mr-2 ${
                      recipe.isEnabled ? "bg-green-500" : "bg-gray-300"
                    }`}
                  />
                  <span className="text-gray-600">
                    {recipe.isEnabled ? "Enabled" : "Disabled"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block w-2 h-2 rounded-full mr-2 ${
                      recipe.isModerated ? "bg-green-500" : "bg-gray-300"
                    }`}
                  />
                  <span className="text-gray-600">
                    {recipe.isModerated ? "Moderated" : "Pending"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block w-2 h-2 rounded-full mr-2 ${
                      recipe.isForReparsing ? "bg-amber-500" : "bg-gray-300"
                    }`}
                  />
                  <span className="text-gray-600">
                    {recipe.isForReparsing ? "For reparsing" : "—"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/recipes/${recipe.id}`}
                    className="text-indigo-600 hover:text-indigo-800 font-medium"
                  >
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-sm text-gray-400">
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={`/recipes?page=${page - 1}${moderated ? `&moderated=${moderated}` : ""}${reparsing ? `&reparsing=${reparsing}` : ""}`}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded hover:bg-gray-50"
              >
                Previous
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={`/recipes?page=${page + 1}${moderated ? `&moderated=${moderated}` : ""}${reparsing ? `&reparsing=${reparsing}` : ""}`}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded hover:bg-gray-50"
              >
                Next
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
