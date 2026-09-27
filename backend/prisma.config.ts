import { defineConfig } from "prisma/config";

// Prisma 7: connection settings live here, not in schema.prisma. A placeholder URL keeps
// `prisma generate` working in builds where no database is reachable.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: process.env.DATABASE_URL ?? "postgresql://build:build@localhost:5432/build" },
});
