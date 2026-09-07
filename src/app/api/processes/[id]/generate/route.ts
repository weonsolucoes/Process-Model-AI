import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/auth";
import { handleRouteError, ValidationError } from "@/lib/apiHelpers";
import { loadOwnedProcess, logAIInteraction, parseModel } from "@/lib/processService";
import { generateAllOutputs } from "@/lib/output";

/** Spec §25 — generates the four deliverables as an immutable snapshot of the audited Process Model. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const process = await loadOwnedProcess(userId, id);

    if (process.status !== "AUDITED") {
      throw new ValidationError("O processo precisa ser aprovado pela auditoria antes da geração dos entregáveis.");
    }

    const model = parseModel(process);
    const outputs = generateAllOutputs(model);

    await prisma.$transaction([
      prisma.output.create({ data: { processId: id, type: "AS_IS", format: "HTML", content: outputs.asIsHtml } }),
      prisma.output.create({ data: { processId: id, type: "DIAGNOSIS", format: "HTML", content: outputs.diagnosisHtml } }),
      prisma.output.create({ data: { processId: id, type: "QUICK_WINS", format: "HTML", content: outputs.quickWinsHtml } }),
      prisma.output.create({ data: { processId: id, type: "FLOWCHART", format: "HTML", content: outputs.flowchartHtml } }),
      prisma.output.create({ data: { processId: id, type: "FLOWCHART", format: "MERMAID", content: outputs.flowchartMermaid } }),
      prisma.process.update({ where: { id }, data: { status: "COMPLETED" } }),
    ]);

    await logAIInteraction({
      processId: id,
      kind: "OUTPUT",
      model: "output-engine-v1",
      usage: { promptTokens: 0, completionTokens: 0 },
      decisionSummary: "Entregáveis gerados a partir do Process Model auditado.",
    });

    return NextResponse.json({ status: "COMPLETED", outputs });
  } catch (err) {
    return handleRouteError(err);
  }
}
