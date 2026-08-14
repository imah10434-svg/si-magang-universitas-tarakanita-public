import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { getSql } from "@/lib/db";

const scrypt = promisify(scryptCallback);
export const SESSION_COOKIE = "si_magang_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  major: string;
  studyProgram: string;
  nim: string;
  semester: number | null;
  cohort: string;
  organization: string;
  internId: string | null;
  company: string;
  supervisorName: string;
  lecturerName: string;
  startDate: string | null;
  endDate: string | null;
};

const toAuthUser = (row: Record<string, unknown>): AuthUser => ({
  id: String(row.id),
  email: String(row.email),
  name: String(row.name),
  role: String(row.role),
  major: String(row.major ?? ""),
  studyProgram: String(row.studyProgram ?? ""),
  nim: String(row.nim ?? ""),
  semester: row.semester === null || row.semester === undefined ? null : Number(row.semester),
  cohort: String(row.cohort ?? ""),
  organization: String(row.organization ?? ""),
  internId: row.internId ? String(row.internId) : null,
  company: String(row.company ?? ""),
  supervisorName: String(row.supervisorName ?? ""),
  lecturerName: String(row.lecturerName ?? ""),
  startDate: row.startDate ? String(row.startDate) : null,
  endDate: row.endDate ? String(row.endDate) : null,
});

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt$${salt}$${derivedKey.toString("hex")}`;
}

export async function verifyPassword(password: string, storedHash: string) {
  const [algorithm, salt, storedKey] = storedHash.split("$");
  if (algorithm !== "scrypt" || !salt || !storedKey) return false;
  const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
  const expectedKey = Buffer.from(storedKey, "hex");
  return expectedKey.length === derivedKey.length && timingSafeEqual(expectedKey, derivedKey);
}

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function makeSessionToken() {
  return randomBytes(32).toString("hex");
}

export function userSelectSql() {
  return undefined;
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const sql = getSql();
  if (!sql) return null;
  const sessionToken = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!sessionToken) return null;

  const rows = await sql`
    SELECT u.id, u.email, u.name, u.role, u.major,
      u.study_program AS "studyProgram", u.nim, u.semester, u.cohort,
      u.organization, i.id AS "internId", i.company,
      i.supervisor_name AS "supervisorName", i.lecturer_name AS "lecturerName",
      i.start_date AS "startDate", i.end_date AS "endDate"
    FROM app_users u
    JOIN app_sessions s ON s.user_id = u.id
    LEFT JOIN interns i ON i.user_id = u.id
    WHERE s.token_hash = ${hashSessionToken(sessionToken)}
      AND s.expires_at > NOW()
    LIMIT 1
  `;
  return rows[0] ? toAuthUser(rows[0] as Record<string, unknown>) : null;
}

export async function createSession(response: Response, userId: string) {
  const sql = getSql();
  if (!sql) throw new Error("DATABASE_URL belum dikonfigurasi");
  const token = makeSessionToken();
  await sql`
    INSERT INTO app_sessions (id, user_id, token_hash, expires_at)
    VALUES (${`session-${randomBytes(12).toString("hex")}`}, ${userId}, ${hashSessionToken(token)}, NOW() + INTERVAL '7 days')
  `;
  response.headers.append("Set-Cookie", `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`);
}

export async function deleteCurrentSession(response: Response) {
  const sql = getSql();
  const sessionToken = (await cookies()).get(SESSION_COOKIE)?.value;
  if (sql && sessionToken) {
    await sql`DELETE FROM app_sessions WHERE token_hash = ${hashSessionToken(sessionToken)}`;
  }
  response.headers.append("Set-Cookie", `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${process.env.NODE_ENV === "production" ? "; Secure" : ""}`);
}

export const authUserFromRow = toAuthUser;
