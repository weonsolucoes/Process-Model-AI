import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword, setSessionCookie } from "@/lib/auth";
import { handleRouteError, parseJsonBody, ValidationError } from "@/lib/apiHelpers";

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "A senha deve ter ao menos 8 caracteres"),
});

export async function POST(request: Request) {
  try {
    const { email, password } = await parseJsonBody(request, RegisterSchema);

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ValidationError("Este email já está cadastrado");
    }

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: { email, passwordHash },
      select: { id: true, email: true },
    });

    await setSessionCookie(user.id);
    return NextResponse.json({ user }, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
