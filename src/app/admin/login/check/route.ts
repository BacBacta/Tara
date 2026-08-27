import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit, makeAdminCookie, verifyPassword } from "@/lib/admin";

const input = z.object({ email: z.string().email(), password: z.string().min(6).max(200) });

export async function POST(req: NextRequest) {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const form = await req.formData();
  const parsed = input.safeParse({
    email: form.get("email"),
    password: form.get("password"),
  });
  if (!parsed.success) return NextResponse.redirect(`${base}/admin/login?err=1`, 303);

  const admin = await db
    .selectFrom("admin_users")
    .selectAll()
    .where("email", "=", parsed.data.email.toLowerCase())
    .executeTakeFirst();
  if (!admin || !verifyPassword(parsed.data.password, admin.password_hash)) {
    return NextResponse.redirect(`${base}/admin/login?err=1`, 303);
  }

  await audit(admin.email, "login", "admin");
  const res = NextResponse.redirect(`${base}/admin`, 303);
  const c = makeAdminCookie(admin.id, admin.email);
  res.cookies.set(c.name, c.value, c.options);
  return res;
}
