import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.local" });

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    // Migrations need a session connection, not the transaction pooler.
    url: process.env.DATABASE_URL_DIRECT ?? "",
  },
});
