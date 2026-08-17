import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getSql } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const sql = getSql();
  if (!sql) return NextResponse.json({ error: "Database belum terhubung." }, { status: 503 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 });
  if (!user.internId) return NextResponse.json({ error: "Data magang belum tersedia." }, { status: 403 });
  const { id } = await params;
  try {
    const rows = await sql`
      SELECT file_name AS "fileName", mime_type AS "mimeType", original_data AS "originalData",
        signed_data AS "signedData"
      FROM signed_documents
      WHERE id = ${id} AND intern_id = ${user.internId}
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
