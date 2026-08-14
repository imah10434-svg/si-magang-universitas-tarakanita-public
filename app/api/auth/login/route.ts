import { NextResponse } from "next/server";
import { createSession, verifyPassword } from "@/lib/auth";
import { getSql } from "@/lib/db";

export async function POST(request: Request) {
  const sql = getSql();
  if (!sql) return NextResponse.json({ error: "Database belum terhubung." }, { status: 503 });

  try {
    const body = await request.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    if (!email || !password) return NextResponse.json({ error: "Email dan password wajib diisi." }, { status: 400 });

    const rows = await sql`
      SELECT u.id, u.email, u.name, u.role, u.major,
        u.study_program AS "studyProgram", u.nim, u.semester, u.cohort,
        u.organization, i.id AS "internId", i.company,
        i.supervisor_name AS "supervisorName", i.lecturer_name AS "lecturerName",
        i.start_date AS "startDate", i.end_date AS "endDate", u.password_hash AS "passwordHash"
      FROM app_users u
      LEFT JOIN interns i ON i.user_id = u.id
      WHERE LOWER(u.email) = ${email}
      LIMIT 1
    `;
    const account = rows[0] as Record<string, unknown> | undefined;
    if (!account || !(await verifyPassword(password, String(account.passwordHash)))) {
      return NextResponse.json({ error: "Email atau password salah." }, { status: 401 });
    }

    const { passwordHash: _passwordHash, ...safeUser } = account;
    const response = NextResponse.json({ user: safeUser });
    await createSession(response, String(account.id));
    return response;
  } catch (error) {
    console.error("POST /api/auth/login failed", error);
    return NextResponse.json({ error: "Gagal masuk. Coba lagi." }, { status: 500 });
  }
}
