"use server";

import { db } from "@/db";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { tags, translations } from "@/db/generated/schema";

function entityTypeForTagType(type: string | null) {
  return type === "recipe_step" ? "cooking_tag" : "tag";
}

export async function createTag(data: {
  id: string;
  label: string;
  labelUk: string;
  icon: string | null;
  type: string | null;
}) {
  await db.insert(tags).values({
    id: data.id,
    label: data.label,
    icon: data.icon,
    type: data.type ?? undefined,
  });

  if (data.labelUk) {
    const entityType = entityTypeForTagType(data.type);
    await db
      .insert(translations)
      .values({ locale: "uk", entityType, entityId: data.id, value: data.labelUk })
      .onConflictDoUpdate({
        target: [translations.locale, translations.entityType, translations.entityId],
        set: { value: data.labelUk },
      });
  }

  revalidatePath("/tags");
  redirect(`/tags/${data.id}`);
}

export async function updateTag(
  id: string,
  data: { label: string; labelUk: string; icon: string | null; type: string | null }
) {
  await db
    .update(tags)
    .set({ label: data.label, icon: data.icon, type: data.type ?? undefined })
    .where(eq(tags.id, id));

  const entityType = entityTypeForTagType(data.type);

  if (data.labelUk) {
    await db
      .insert(translations)
      .values({ locale: "uk", entityType, entityId: id, value: data.labelUk })
      .onConflictDoUpdate({
        target: [translations.locale, translations.entityType, translations.entityId],
        set: { value: data.labelUk },
      });
  } else {
    await db
      .delete(translations)
      .where(
        and(
          eq(translations.locale, "uk"),
          eq(translations.entityType, entityType),
          eq(translations.entityId, id)
        )
      );
  }

  revalidatePath("/tags");
  revalidatePath(`/tags/${id}`);
}

export async function deleteTag(id: string) {
  await db.delete(translations).where(eq(translations.entityId, id));
  await db.delete(tags).where(eq(tags.id, id));
  revalidatePath("/tags");
  redirect("/tags");
}
