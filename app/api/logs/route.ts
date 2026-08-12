import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";

export async function GET() {
  const sql = getSql();
  if (!sql) return NextResponse.json([]);

  try {
    const rows = await sql`
      SELECT id, work_date AS date, title, description, hours, category, status
      FROM daily_logs
      WHERE intern_id = 'demo-intern'
      ORDER BY work_date DESC, created_at DESC
      LIMIT 60
    `;
    return NextResponse.json(rows);
  } catch (error) {
    console.error("GET /api/logs failed", error);
    return NextResponse.json({ error: "Gagal mengambil tracking harian." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const sql = getSql();
  if (!sql) return NextResponse.json({ stored: false, reason: "DATABASE_URL belum dikonfigurasi" });

  try {
    const body = await request.json();
    const id = `log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const hours = Number(body.hours);
    if (!body.date || !body.title || !body.description || !Number.isFinite(hours)) {
      return NextResponse.json({ error: "Data aktivitas belum lengkap." }, { status: 400 });
    }
    const rows = await sql`
      INSERT INTO daily_logs (id, intern_id, work_date, title, description, hours, category, status)
      VALUES (${id}, 'demo-intern', ${body.date}, ${body.title}, ${body.description}, ${hours}, ${body.category ?? "Lainnya"}, ${body.status ?? "Selesai"})
      RETURNING id, work_date AS date, title, description, hours, category, status
    `;
    return NextResponse.json(rows[0], { status: 201 });
  } catch (error) {
    console.error("POST /api/logs failed", error);
    return NextResponse.json({ error: "Gagal menyimpan aktivitas." }, { status: 500 });
  }
}
