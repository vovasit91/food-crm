"use server";

import { db } from "@/db";
import { contentVersion } from "@/db/generated/schema";
import { sql } from "drizzle-orm";

export async function publishContent(): Promise<number> {
  await db.update(contentVersion).set({
    version: sql`${contentVersion.version} + 1`,
    updatedAt: Date.now().toString(),
  });

  const [row] = await db.select({ version: contentVersion.version }).from(contentVersion);
  return row.version;
}
