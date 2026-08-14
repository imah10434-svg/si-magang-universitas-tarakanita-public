import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";

const roles = ["Mahasiswa", "Dosen Pembimbing", "Supervisor Kantor", "Koordinator/Admin"] as const;

export async function GET() {
  const sql = getSql();
  if (!sql) return NextResponse.json([]);

  try {
    const rows = await sql`
      SELECT id, email, name, role, major, study_program AS "studyProgram",
        nim, semester, cohort, organization, created_at AS "createdAt"
      FROM directory_users
      ORDER BY created_at DESC
    `;
    return NextResponse.json(rows);
  } catch (error) {
    console.error("GET /api/users failed", error);
    return NextResponse.json({ error: "Gagal mengambil daftar pengguna." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const sql = getSql();
  if (!sql) return NextResponse.json({ stored: false, reason: "DATABASE_URL belum dikonfigurasi" });

  try {
    const body = await request.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const name = String(body.name ?? "").trim();
    const role = roles.includes(body.role) ? body.role : null;
    const major = String(body.major ?? "").trim();
    const studyProgram = String(body.studyProgram ?? "").trim();
    const nim = String(body.nim ?? "").trim();
    const semester = body.semester === undefined || body.semester === "" ? null : Number(body.semester);
    const cohort = String(body.cohort ?? "").trim();
    const organization = String(body.organization ?? "").trim();

    if (!email.endsWith("@gmail.com") || !name || !role || !Number.isInteger(semester) && semester !== null || (role === "Mahasiswa" && (!major || !studyProgram || !nim || !cohort))) {
      return NextResponse.json({ error: "Gunakan Gmail dan lengkapi data pendaftar." }, { status: 400 });
    }

    const id = `user-${email.replace(/[^a-z0-9]+/gi, "-")}`;
    const rows = await sql`
      INSERT INTO directory_users (id, email, name, role, major, study_program, nim, semester, cohort, organization)
      VALUES (${id}, ${email}, ${name}, ${role}, ${major}, ${studyProgram}, ${nim}, ${semester}, ${cohort}, ${organization})
      ON CONFLICT (email) DO UPDATE SET
        name = EXCLUDED.name,
        role = EXCLUDED.role,
        major = EXCLUDED.major,
        study_program = EXCLUDED.study_program,
        nim = EXCLUDED.nim,
        semester = EXCLUDED.semester,
        cohort = EXCLUDED.cohort,
        organization = EXCLUDED.organization
      RETURNING id, email, name, role, major, study_program AS "studyProgram",
        nim, semester, cohort, organization, created_at AS "createdAt"
    `;
    return NextResponse.json(rows[0], { status: 201 });
  } catch (error) {
    console.error("POST /api/users failed", error);
    return NextResponse.json({ error: "Gagal menyimpan pendaftar." }, { status: 500 });
  }
}
