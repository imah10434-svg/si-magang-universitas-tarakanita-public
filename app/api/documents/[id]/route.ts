import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getSql } from "@/lib/db";

export const runtime = "nodejs";

async function ensureDocumentsTable(sql: NonNullable<ReturnType<typeof getSql>>) {
  await sql`
    CREATE TABLE IF NOT EXISTS signed_documents (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES app_users(id) ON DELETE CASCADE,
      intern_id TEXT REFERENCES interns(id) ON DELETE CASCADE,
      file_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      original_data TEXT NOT NULL,
      signed_data TEXT,
      status TEXT NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'signed')),
      signatures_json TEXT NOT NULL DEFAULT '[]',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`ALTER TABLE signed_documents ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES app_users(id) ON DELETE CASCADE`;
  await sql`ALTER TABLE signed_documents ALTER COLUMN intern_id DROP NOT NULL`;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const sql = getSql();
  if (!sql) return NextResponse.json({ error: "Database belum terhubung." }, { status: 503 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 });
  const { id } = await params;
  try {
    await ensureDocumentsTable(sql);
    const rows = await sql`
      SELECT file_name AS "fileName", mime_type AS "mimeType", original_data AS "originalData",
        signed_data AS "signedData"
      FROM signed_documents
      WHERE id = ${id} AND (user_id = ${user.id} OR (user_id IS NULL AND ${user.internId} IS NOT NULL AND intern_id = ${user.internId}))
      LIMIT 1
    `;
    const row = rows[0] as { fileName: string; mimeType: string; originalData: string; signedData: string | null } | undefined;
    if (!row) return NextResponse.json({ error: "Dokumen tidak ditemukan." }, { status: 404 });
    const version = new URL(request.url).searchParams.get("version") === "original" ? "original" : "signed";
    const data = version === "signed" ? row.signedData : row.originalData;
    if (!data) return NextResponse.json({ error: "Dokumen belum memiliki tanda tangan." }, { status: 404 });
    const extension = row.fileName.toLowerCase().endsWith(".docx") ? ".docx" : ".pdf";
    const stem = row.fileName.replace(/\.(pdf|docx)$/i, "");
    const downloadName = version === "signed" ? `${stem}-bertanda-tangan${extension}` : row.fileName;
    return new NextResponse(new Uint8Array(Buffer.from(data, "base64")), {
      headers: {
        "Content-Type": row.mimeType,
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(downloadName)}`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("GET /api/documents/[id] failed", error);
    return NextResponse.json({ error: "Gagal mengunduh dokumen." }, { status: 500 });
  }
}
