import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/auth";
import { handleRouteError, parseJsonBody } from "@/lib/apiHelpers";
import { createEmptyProcessModel } from "@/domain/processModel";
import { openingQuestion } from "@/lib/interview/engine";

export async function GET() {
  try {
    const userId = await requireUserId();
    const processes = await prisma.process.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      select: { id: true, name: true, area: true, status: true, createdAt: true, updatedAt: true },
    });
    return NextResponse.json({ processes });
  } catch (err) {
    return handleRouteError(err);
  }
}

const CreateProcessSchema = z.object({
  name: z.string().min(1, "Informe o nome do processo"),
  area: z.string().nullable().optional(),
  respondentRole: z.string().nullable().optional(),
  initialDescription: z.string().nullable().optional(),
});

export async function POST(request: Request) {
  try {
    const userId = await requireUserId();
    const body = await parseJsonBody(request, CreateProcessSchema);

    const identification = {
      processName: body.name,
      area: body.area ?? null,
      respondentRole: body.respondentRole ?? null,
      initialDescription: body.initialDescription ?? null,
    };
    const model = createEmptyProcessModel(identification);

    const process = await prisma.process.create({
      data: {
        userId,
        name: body.name,
        area: body.area ?? null,
        respondentRole: body.respondentRole ?? null,
        initialDescription: body.initialDescription ?? null,
        modelJson: model,
        messages: {
          create: [{ role: "ASSISTANT", content: openingQuestion(identification) }],
        },
      },
      include: { messages: true },
    });

    return NextResponse.json({ process }, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
