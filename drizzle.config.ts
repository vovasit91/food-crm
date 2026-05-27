import type { Config } from "drizzle-kit";

export default {
  schema: "./db/schema.ts",
  out: "./db/generated",
  dialect: "turso",
  dbCredentials: {
    url: process.env.TURSO_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  },
} satisfies Config;
