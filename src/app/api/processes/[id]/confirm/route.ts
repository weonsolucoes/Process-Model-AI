import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/auth";
import { handleRouteError, ValidationError } from "@/lib/apiHelpers";
import { loadOwnedProcess, logAIInteraction, parseModel } from "@/lib/processService";
import { runAudit } from "@/lib/auditor/auditor";
import { getAIProvider } from "@/lib/ai";
import { defaultQuestionForGap } from "@/lib/interview/completeness";

/**
 * Spec §31 — runs the AI Auditor once the user has validated the synthesis.
 * Approval flips the process to AUDITED (ready for output generation);
 * rejection reopens the interview with a targeted follow-up question
 * instead of leaving the user stuck with no next step.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const process = await loadOwnedProcess(userId, id);

    if (process.status !== "VALIDATION") {
      throw new ValidationError("O processo precisa passar pela validação do usuário antes da auditoria.");
    }

    const model = parseModel(process);
    const { result, usage, aiModel } = await runAudit(model, getAIProvider());

    await logAIInteraction({
      processId: id,
      kind: "AUDIT",
      model: aiModel,
      usage,
      decisionSummary: result.summary,
    });

    if (result.approved) {
      await prisma.process.update({
        where: { id },
        data: { status: "AUDITED", lastAuditJson: result },
      });
      return NextResponse.json({ audit: result, status: "AUDITED" });
    }

    const followUp = defaultQuestionForGap(result.missingCritical[0] ?? "fluxo principal");
    await prisma.$transaction([
      prisma.process.update({
        where: { id },
        data: { status: "INTERVIEW", lastAuditJson: result },
      }),
      prisma.message.create({
        data: {
          processId: id,
          role: "ASSISTANT",
          content: `A auditoria encontrou pendências antes de seguir: ${result.missingCritical.join(", ")}. ${followUp}`,
        },
      }),
    ]);

    return NextResponse.json({ audit: result, status: "INTERVIEW" });
  } catch (err) {
    return handleRouteError(err);
  }
}
