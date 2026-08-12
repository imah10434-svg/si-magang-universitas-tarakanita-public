import { neon } from "@neondatabase/serverless";

export function getSql() {
  const connectionString = process.env.DATABASE_URL;
  return connectionString ? neon(connectionString) : null;
}

export function hasDatabase() {
  return Boolean(process.env.DATABASE_URL);
}
