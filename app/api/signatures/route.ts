import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getSql } from "@/lib/db";

export async function GET() {
  const sql = getSql();
  const user = await getCurrentUser();
  if (!sql) return NextResponse.json({ error: "Database belum terhubung." }, { status: 503 });
  if (!user) return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 });
  if (!user.internId) return NextResponse.json([]);

  try {
    const rows = await sql`
      SELECT role, name, title, signature_data AS "signatureData", signed_at AS "signedAt"
      FROM signatures
      WHERE intern_id = ${user.internId}
      ORDER BY role
    `;
    return NextResponse.json(rows);
  } catch (error) {
    console.error("GET /api/signatures failed", error);
    return NextResponse.json({ error: "Gagal mengambil tanda tangan." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const sql = getSql();
  const user = await getCurrentUser();
  if (!sql) return NextResponse.json({ error: "Database belum terhubung." }, { status: 503 });
  if (!user) return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 });
  if (!user.internId) return NextResponse.json({ error: "Akun ini belum memiliki profil mahasiswa." }, { status: 403 });

  try {
    const body = await request.json();
    const role = body.role === "dosen" ? "dosen" : body.role === "supervisor" ? "supervisor" : null;
    if (!role || !body.name || !body.signatureData) {
      return NextResponse.json({ error: "Data tanda tangan belum lengkap." }, { status: 400 });
    }
    const id = `signature-${role}`;
    const title = role === "supervisor" ? "Supervisor Magang · PT Solusi Digital Nusantara" : "Dosen Pembimbing · Universitas Tarakanita";
    const rows = await sql`
      INSERT INTO signatures (id, intern_id, role, name, title, signature_data)
      VALUES (${id}, ${user.internId}, ${role}, ${body.name}, ${title}, ${body.signatureData})
      ON CONFLICT (intern_id, role) DO UPDATE SET
        name = EXCLUDED.name,
        title = EXCLUDED.title,
        signature_data = EXCLUDED.signature_data,
        signed_at = NOW()
      RETURNING role, name, title, signature_data AS "signatureData", signed_at AS "signedAt"
    `;
    return NextResponse.json(rows[0], { status: 201 });
  } catch (error) {
    console.error("POST /api/signatures failed", error);
    return NextResponse.json({ error: "Gagal menyimpan tanda tangan." }, { status: 500 });
  }
}
