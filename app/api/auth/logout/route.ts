import { NextResponse } from "next/server";
import { deleteCurrentSession } from "@/lib/auth";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  try {
    await deleteCurrentSession(response);
  } catch (error) {
    console.error("POST /api/auth/logout failed", error);
  }
  return response;
}
