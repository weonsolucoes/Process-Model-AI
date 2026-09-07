import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { setSessionCookie, verifyPassword, UnauthorizedError } from "@/lib/auth";
import { handleRouteError, parseJsonBody } from "@/lib/apiHelpers";

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const { email, password } = await parseJsonBody(request, LoginSchema);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      throw new UnauthorizedError("Email ou senha inválidos");
    }

    await setSessionCookie(user.id);
    return NextResponse.json({ user: { id: user.id, email: user.email } });
  } catch (err) {
    return handleRouteError(err);
  }
}
