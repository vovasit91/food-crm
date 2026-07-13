import { db } from "@/db";
import { tags, translations } from "@/db/generated/schema";
import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import TagEditor from "@/app/tags/TagEditor";

export const dynamic = "force-dynamic";

export default async function TagPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [tag] = await db.select().from(tags).where(eq(tags.id, id));
  if (!tag) notFound();

  const entityType = tag.type === "recipe_step" ? "cooking_tag" : "tag";

  const [uaTranslation] = await db
    .select({ value: translations.value })
    .from(translations)
    .where(
      and(
        eq(translations.entityType, entityType),
        eq(translations.entityId, id),
        eq(translations.locale, "uk")
      )
    );

  return (
    <TagEditor
      mode="edit"
      initial={{
        id: tag.id,
        label: tag.label,
        labelUk: uaTranslation?.value ?? "",
        icon: tag.icon ?? "",
        type: tag.type ?? "",
      }}
    />
  );
}
