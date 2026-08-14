import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getSql } from "@/lib/db";

export async function GET() {
  const sql = getSql();
  if (!sql) return NextResponse.json({ error: "Database belum terhubung." }, { status: 503 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 });
  return NextResponse.json(user);
}

export async function POST(request: Request) {
  const sql = getSql();
  if (!sql) return NextResponse.json({ error: "Database belum terhubung." }, { status: 503 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 });

  try {
    const body = await request.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const name = String(body.name ?? "").trim();
    const major = String(body.major ?? "").trim();
    const studyProgram = String(body.studyProgram ?? "").trim();
    const nim = String(body.nim ?? "").trim();
    const semester = body.semester === "" || body.semester === null || body.semester === undefined ? null : Number(body.semester);
    const cohort = String(body.cohort ?? "").trim();
    const isStudent = user.role === "Mahasiswa";

    if (!/^[^\s@]+@gmail\.com$/i.test(email) || !name || (semester !== null && (!Number.isInteger(semester) || semester < 1 || semester > 20)) || (isStudent && (!major || !studyProgram || !nim || semester === null || !cohort))) {
      return NextResponse.json({ error: "Lengkapi data profil dengan benar." }, { status: 400 });
    }

    const rows = await sql`
      UPDATE app_users
      SET email = ${email}, name = ${name}, major = ${major},
        study_program = ${studyProgram}, nim = ${nim}, semester = ${semester}, cohort = ${cohort}
      WHERE id = ${user.id}
      RETURNING id, email, name, role, major, study_program AS "studyProgram",
        nim, semester, cohort, organization
    `;
    if (!rows[0]) return NextResponse.json({ error: "Akun tidak ditemukan." }, { status: 404 });

    if (user.internId) {
      await sql`
        UPDATE interns
        SET email = ${email}, name = ${name}, major = ${major}, study_program = ${studyProgram},
          student_id = ${nim}, semester = ${semester}, cohort = ${cohort}, program = ${studyProgram}
        WHERE id = ${user.internId}
      `;
    }
    return NextResponse.json({ ...user, ...rows[0], internId: user.internId });
  } catch (error) {
    console.error("POST /api/profile failed", error);
    return NextResponse.json({ error: "Gagal menyimpan profil pengguna." }, { status: 500 });
  }
}
