import "dotenv/config";
import { defineConfig } from "drizzle-kit";
import path from "path";

// Load from root if needed (dotenv/config usually loads .env in CWD, 
// but drizzle-kit might be running from root or lib/db)
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  schema: "./src/schema/*.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
