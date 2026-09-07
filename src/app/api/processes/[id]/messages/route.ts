import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/auth";
import { handleRouteError, parseJsonBody, ValidationError } from "@/lib/apiHelpers";
import { loadOwnedProcess, logAIInteraction, parseModel } from "@/lib/processService";
import { runInterviewTurn } from "@/lib/interview/engine";
import { getAIProvider } from "@/lib/ai";
import type { ConversationTurn } from "@/lib/ai/provider";

const MessageSchema = z.object({ content: z.string().min(1) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const process = await loadOwnedProcess(userId, id);

    if (process.status !== "INTERVIEW") {
      throw new ValidationError("A entrevista deste processo já foi concluída.");
    }

    const { content } = await parseJsonBody(request, MessageSchema);

    const priorMessages = await prisma.message.findMany({
      where: { processId: id },
      orderBy: { createdAt: "asc" },
    });
    const history: ConversationTurn[] = priorMessages
      .filter((m) => m.role !== "SYSTEM")
      .map((m) => ({ role: m.role === "USER" ? "user" : "assistant", content: m.content }));

    const model = parseModel(process);
    const outcome = await runInterviewTurn(model, history, content, getAIProvider());

    await prisma.$transaction([
      prisma.message.create({ data: { processId: id, role: "USER", content } }),
      prisma.message.create({ data: { processId: id, role: "ASSISTANT", content: outcome.assistantMessage } }),
      prisma.process.update({
        where: { id },
        data: {
          modelJson: outcome.model,
          status: outcome.interviewComplete ? "VALIDATION" : "INTERVIEW",
        },
      }),
    ]);

    await logAIInteraction({
      processId: id,
      kind: "EXTRACTION",
      model: outcome.aiModel,
      usage: outcome.usage,
      decisionSummary: outcome.decisionSummary,
    });

    return NextResponse.json({
      assistantMessage: outcome.assistantMessage,
      interviewComplete: outcome.interviewComplete,
      status: outcome.interviewComplete ? "VALIDATION" : "INTERVIEW",
      model: outcome.model,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
