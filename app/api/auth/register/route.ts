import { NextResponse } from "next/server";
import { createSession, hashPassword } from "@/lib/auth";
import { getSql } from "@/lib/db";

const roles = ["Mahasiswa", "Dosen Pembimbing", "Supervisor Kantor", "Koordinator/Admin"] as const;

export async function POST(request: Request) {
  const sql = getSql();
  if (!sql) return NextResponse.json({ error: "Database belum terhubung." }, { status: 503 });

  try {
    const body = await request.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const name = String(body.name ?? "").trim();
    const role = roles.includes(body.role) ? body.role : null;
    const major = String(body.major ?? "").trim();
    const studyProgram = String(body.studyProgram ?? "").trim();
    const nim = String(body.nim ?? "").trim();
    const semester = body.semester === undefined || body.semester === "" ? null : Number(body.semester);
    const cohort = String(body.cohort ?? "").trim();
    const organization = String(body.organization ?? "").trim();

    if (!/^[^\s@]+@gmail\.com$/i.test(email)) {
      return NextResponse.json({ error: "Gunakan alamat Gmail yang valid, misalnya nama@gmail.com." }, { status: 400 });
    }
    if (password.length < 8 || password.length > 128) {
      return NextResponse.json({ error: "Password harus berisi 8–128 karakter." }, { status: 400 });
    }
    if (!name || !role || (semester !== null && (!Number.isInteger(semester) || semester < 1 || semester > 20))) {
      return NextResponse.json({ error: "Lengkapi data akun dengan benar." }, { status: 400 });
    }
    if (role === "Mahasiswa" && (!major || !studyProgram || !nim || !cohort || semester === null)) {
      return NextResponse.json({ error: "Data mahasiswa wajib dilengkapi." }, { status: 400 });
    }

    const existing = await sql`SELECT id FROM app_users WHERE LOWER(email) = ${email} LIMIT 1`;
    if (existing.length) {
      return NextResponse.json({ error: "Email ini sudah terdaftar. Silakan masuk." }, { status: 409 });
    }

    const userId = `user-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const internId = `intern-${userId}`;
    const passwordHash = await hashPassword(password);
    const company = organization || "Tempat magang belum diisi";
    const rows = await sql`
      WITH inserted_user AS (
        INSERT INTO app_users (id, email, password_hash, name, role, major, study_program, nim, semester, cohort, organization)
        VALUES (${userId}, ${email}, ${passwordHash}, ${name}, ${role}, ${major}, ${studyProgram}, ${nim}, ${semester}, ${cohort}, ${organization})
        RETURNING id, email, name, role, major, study_program AS "studyProgram", nim, semester, cohort, organization
      ),
      inserted_intern AS (
        INSERT INTO interns (id, user_id, email, name, student_id, program, major, study_program, semester, cohort, company, supervisor_name, lecturer_name, start_date, end_date)
        SELECT ${internId}, id, email, name, nim, study_program, major, study_program, semester, cohort,
          ${company}, 'Supervisor belum ditentukan', 'Dosen pembimbing belum ditentukan', CURRENT_DATE, CURRENT_DATE + 90
        FROM inserted_user
        WHERE role = 'Mahasiswa'
        RETURNING id
      )
      SELECT iu.*, ii.id AS "internId", ${company} AS company,
        'Supervisor belum ditentukan' AS "supervisorName",
        'Dosen pembimbing belum ditentukan' AS "lecturerName",
        CURRENT_DATE AS "startDate", (CURRENT_DATE + 90) AS "endDate"
      FROM inserted_user iu
      LEFT JOIN inserted_intern ii ON TRUE
    `;

    try {
      await sql`
        INSERT INTO directory_users (id, email, name, role, major, study_program, nim, semester, cohort, organization)
        VALUES (${userId}, ${email}, ${name}, ${role}, ${major}, ${studyProgram}, ${nim}, ${semester}, ${cohort}, ${organization})
        ON CONFLICT (email) DO UPDATE SET
          name = EXCLUDED.name, role = EXCLUDED.role, major = EXCLUDED.major,
          study_program = EXCLUDED.study_program, nim = EXCLUDED.nim,
          semester = EXCLUDED.semester, cohort = EXCLUDED.cohort, organization = EXCLUDED.organization
      `;
    } catch (directoryError) {
      console.error("Registration directory sync failed", directoryError);
    }

    const response = NextResponse.json({ user: rows[0] }, { status: 201 });
    await createSession(response, userId);
    return response;
  } catch (error) {
    console.error("POST /api/auth/register failed", error);
    return NextResponse.json({ error: "Gagal membuat akun. Coba lagi." }, { status: 500 });
  }
}
