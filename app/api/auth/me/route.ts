import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getCurrentUser();
    return user ? NextResponse.json({ user }) : NextResponse.json({ user: null }, { status: 401 });
  } catch (error) {
    console.error("GET /api/auth/me failed", error);
    return NextResponse.json({ user: null }, { status: 401 });
  }
}
