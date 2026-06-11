import { defineConfig } from 'drizzle-kit';

// Local-dev fallback matches docker-compose.yml (not a secret — local container only).
// Production always supplies DATABASE_URL via the environment (TOOLS.md).
const url = process.env.DATABASE_URL ?? 'postgres://stringer:stringer@localhost:5432/stringer';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema.ts',
  out: './drizzle',
  dbCredentials: { url },
});
