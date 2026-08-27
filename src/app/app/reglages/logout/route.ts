import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/session";

export async function POST() {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const res = NextResponse.redirect(`${base}/`, 303);
  res.cookies.set(SESSION_COOKIE, "", { maxAge: 0, path: "/" });
  return res;
}
