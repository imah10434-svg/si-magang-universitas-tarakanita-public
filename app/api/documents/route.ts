import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getSql } from "@/lib/db";

export const runtime = "nodejs";

const MAX_FILE_BYTES = 3_000_000;
const PDF_MIME = "application/pdf";
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

async function ensureDocumentsTable(sql: NonNullable<ReturnType<typeof getSql>>) {
  await sql`
    CREATE TABLE IF NOT EXISTS signed_documents (
      id TEXT PRIMARY KEY,
      intern_id TEXT NOT NULL REFERENCES interns(id) ON DELETE CASCADE,
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
  await sql`CREATE INDEX IF NOT EXISTS signed_documents_intern_created_idx ON signed_documents (intern_id, created_at DESC)`;
}

function cleanFileName(value: string) {
  const cleaned = value.replace(/[^a-zA-Z0-9._ -]/g, "_").trim();
  return (cleaned || "dokumen-magang").slice(0, 120);
}

function parseUploadData(value: string) {
  const clean = value.replace(/^data:[^;]+;base64,/i, "").replace(/\s/g, "");
  if (!clean || !/^[A-Za-z0-9+/]+={0,2}$/.test(clean)) return null;
  const bytes = Buffer.from(clean, "base64");
  if (!bytes.length || bytes.length > MAX_FILE_BYTES) return null;
  return { base64: bytes.toString("base64"), bytes };
}

function isSupportedDocument(fileName: string, mimeType: string, bytes: Buffer) {
  const lowerName = fileName.toLowerCase();
  const isPdf = mimeType === PDF_MIME || lowerName.endsWith(".pdf");
  const isDocx = mimeType === DOCX_MIME || lowerName.endsWith(".docx");
  if (isPdf) return bytes.subarray(0, 5).toString("ascii") === "%PDF-";
  if (isDocx) return bytes.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
  return false;
}

function parseSignatures(value: unknown) {
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function serializeDocument(row: Record<string, unknown>) {
  return {
    id: row.id,
    fileName: row.fileName,
    mimeType: row.mimeType,
    status: row.status,
    signatures: parseSignatures(row.signaturesJson),
    hasSignedData: Boolean(row.hasSignedData),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function GET() {
  const sql = getSql();
  if (!sql) return NextResponse.json({ error: "Database belum terhubung." }, { status: 503 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 });
  if (!user.internId) return NextResponse.json([]);
  try {
    await ensureDocumentsTable(sql);
    const rows = await sql`
      SELECT id, file_name AS "fileName", mime_type AS "mimeType", status,
        signatures_json AS "signaturesJson", (signed_data IS NOT NULL) AS "hasSignedData",
        created_at AS "createdAt", updated_at AS "updatedAt"
      FROM signed_documents
      WHERE intern_id = ${user.internId}
      ORDER BY created_at DESC
    `;
    return NextResponse.json(rows.map((row) => serializeDocument(row as Record<string, unknown>)));
  } catch (error) {
    console.error("GET /api/documents failed", error);
    return NextResponse.json({ error: "Gagal mengambil dokumen." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const sql = getSql();
  if (!sql) return NextResponse.json({ error: "Database belum terhubung." }, { status: 503 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 });
  if (!user.internId) return NextResponse.json({ error: "Akun ini belum memiliki data magang." }, { status: 403 });
  try {
    const body = await request.json();
    const fileName = cleanFileName(String(body.fileName ?? ""));
    const mimeType = String(body.mimeType ?? "").toLowerCase();
    const upload = parseUploadData(String(body.data ?? ""));
    if (!upload || !isSupportedDocument(fileName, mimeType, upload.bytes)) {
      return NextResponse.json({ error: "Unggah PDF atau Word .docx yang valid, maksimal 3 MB." }, { status: 400 });
    }
    await ensureDocumentsTable(sql);
    const id = `document-${randomUUID()}`;
    const rows = await sql`
      INSERT INTO signed_documents (id, intern_id, file_name, mime_type, original_data)
      VALUES (${id}, ${user.internId}, ${fileName}, ${mimeType === DOCX_MIME || fileName.toLowerCase().endsWith(".docx") ? DOCX_MIME : PDF_MIME}, ${upload.base64})
      RETURNING id, file_name AS "fileName", mime_type AS "mimeType", status,
        signatures_json AS "signaturesJson", FALSE AS "hasSignedData",
        created_at AS "createdAt", updated_at AS "updatedAt"
    `;
    return NextResponse.json(serializeDocument(rows[0] as Record<string, unknown>), { status: 201 });
  } catch (error) {
    console.error("POST /api/documents failed", error);
    return NextResponse.json({ error: "Gagal menyimpan dokumen." }, { status: 500 });
  }
}
