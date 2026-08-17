import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { signDocument, type DocumentSigner } from "@/lib/document-signing";
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

function parseSignatures(value: unknown): DocumentSigner[] {
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is DocumentSigner => item && (item.role === "supervisor" || item.role === "dosen") && typeof item.name === "string" && typeof item.signedAt === "string");
  } catch {
    return [];
  }
}

function serializeDocument(row: Record<string, unknown>) {
  let signatures: DocumentSigner[] = [];
  try {
    const parsed = JSON.parse(String(row.signaturesJson ?? "[]"));
    if (Array.isArray(parsed)) signatures = parsed;
  } catch {
    signatures = [];
  }
  return {
    id: row.id,
    fileName: row.fileName,
    mimeType: row.mimeType,
    status: row.status,
    signatures,
    hasSignedData: Boolean(row.hasSignedData),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const sql = getSql();
  if (!sql) return NextResponse.json({ error: "Database belum terhubung." }, { status: 503 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 });
  const { id } = await params;
  try {
    const body = await request.json();
    const role = body.role === "supervisor" ? "supervisor" : body.role === "dosen" ? "dosen" : null;
    const name = String(body.name ?? "").trim();
    const signatureData = String(body.signatureData ?? "");
    if (!role || !name || !/^data:image\/png;base64,/i.test(signatureData)) return NextResponse.json({ error: "Data TTD belum lengkap." }, { status: 400 });
    await ensureDocumentsTable(sql);
    const rows = await sql`
      SELECT id, file_name AS "fileName", mime_type AS "mimeType", original_data AS "originalData",
        signed_data AS "signedData", signatures_json AS "signaturesJson"
      FROM signed_documents
      WHERE id = ${id} AND (user_id = ${user.id} OR (user_id IS NULL AND ${user.internId} IS NOT NULL AND intern_id = ${user.internId}))
      LIMIT 1
    `;
    const row = rows[0] as { id: string; fileName: string; mimeType: string; originalData: string; signedData: string | null; signaturesJson: string } | undefined;
    if (!row) return NextResponse.json({ error: "Dokumen tidak ditemukan." }, { status: 404 });
    const signatures = parseSignatures(row.signaturesJson);
    if (signatures.some((item) => item.role === role)) return NextResponse.json({ error: "Peran ini sudah menandatangani dokumen tersebut." }, { status: 409 });
    const signer: DocumentSigner = { role, name, signedAt: new Date().toISOString() };
    const signedData = signDocument({ fileName: row.fileName, mimeType: row.mimeType, data: row.signedData || row.originalData, signatureData, signer, signatureIndex: signatures.length });
    const nextSignatures = [...signatures, signer];
    const updated = await sql`
      UPDATE signed_documents
      SET signed_data = ${signedData}, status = 'signed', signatures_json = ${JSON.stringify(nextSignatures)}, updated_at = NOW()
      WHERE id = ${id} AND (user_id = ${user.id} OR (user_id IS NULL AND ${user.internId} IS NOT NULL AND intern_id = ${user.internId}))
      RETURNING id, file_name AS "fileName", mime_type AS "mimeType", status,
        signatures_json AS "signaturesJson", (signed_data IS NOT NULL) AS "hasSignedData",
        created_at AS "createdAt", updated_at AS "updatedAt"
    `;
    return NextResponse.json(serializeDocument(updated[0] as Record<string, unknown>));
  } catch (error) {
    console.error("POST /api/documents/[id]/sign failed", error);
    const message = error instanceof Error ? error.message : "Gagal menempelkan TTD ke dokumen.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
