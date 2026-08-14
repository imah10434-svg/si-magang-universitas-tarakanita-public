import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";

export async function GET() {
  const sql = getSql();
  if (!sql) return NextResponse.json(null);

  try {
    const rows = await sql`
      SELECT id, email, name, major, study_program AS "studyProgram",
        student_id AS "nim", semester, cohort, program,
        company, supervisor_name AS "supervisorName",
        lecturer_name AS "lecturerName", start_date AS "startDate", end_date AS "endDate"
      FROM interns
      WHERE id = 'demo-intern'
      LIMIT 1
    `;
    return NextResponse.json(rows[0] ?? null);
  } catch (error) {
    console.error("GET /api/profile failed", error);
    return NextResponse.json({ error: "Gagal mengambil profil pengguna." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const sql = getSql();
  if (!sql) return NextResponse.json({ stored: false, reason: "DATABASE_URL belum dikonfigurasi" });

  try {
    const body = await request.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const name = String(body.name ?? "").trim();
    const major = String(body.major ?? "").trim();
    const studyProgram = String(body.studyProgram ?? "").trim();
    const nim = String(body.nim ?? "").trim();
    const semester = Number(body.semester);
    const cohort = String(body.cohort ?? "").trim();

    if (!email || !email.includes("@") || !name || !major || !studyProgram || !nim || !Number.isInteger(semester) || semester < 1 || semester > 20 || !cohort) {
      return NextResponse.json({ error: "Lengkapi data profil dengan benar." }, { status: 400 });
    }

    const rows = await sql`
      UPDATE interns
      SET email = ${email},
          name = ${name},
          major = ${major},
          study_program = ${studyProgram},
          student_id = ${nim},
          semester = ${semester},
          cohort = ${cohort},
          program = ${studyProgram}
      WHERE id = 'demo-intern'
      RETURNING id, email, name, major, study_program AS "studyProgram",
        student_id AS "nim", semester, cohort, program,
        company, supervisor_name AS "supervisorName",
        lecturer_name AS "lecturerName", start_date AS "startDate", end_date AS "endDate"
    `;
    return NextResponse.json(rows[0] ?? null, { status: 200 });
  } catch (error) {
    console.error("POST /api/profile failed", error);
    return NextResponse.json({ error: "Gagal menyimpan profil pengguna." }, { status: 500 });
  }
}
