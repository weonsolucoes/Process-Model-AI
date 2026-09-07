import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/auth";
import { handleRouteError, NotFoundError, ValidationError } from "@/lib/apiHelpers";
import { loadOwnedProcess } from "@/lib/processService";
import { renderHtmlToPdf } from "@/lib/output/pdf";
import type { OutputType } from "@prisma/client";

const TYPE_MAP: Record<string, OutputType> = {
  "as-is": "AS_IS",
  diagnosis: "DIAGNOSIS",
  "quick-wins": "QUICK_WINS",
  flowchart: "FLOWCHART",
};

const FILE_BASENAMES: Record<OutputType, string> = {
  AS_IS: "as-is",
  DIAGNOSIS: "diagnostico",
  QUICK_WINS: "quick-wins",
  FLOWCHART: "fluxograma",
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; type: string }> },
) {
  try {
    const userId = await requireUserId();
    const { id, type: rawType } = await params;
    await loadOwnedProcess(userId, id);

    const type = TYPE_MAP[rawType];
    if (!type) throw new ValidationError(`Tipo de exportação desconhecido: ${rawType}`);

    const format = (new URL(request.url).searchParams.get("format") ?? "html").toLowerCase();
    const basename = FILE_BASENAMES[type];

    if (type === "FLOWCHART" && format === "pdf") {
      throw new ValidationError(
        "Exportação em PDF ainda não é suportada para o fluxograma nesta versão — use html ou mermaid.",
      );
    }

    const wantedFormat = type === "FLOWCHART" && format === "mermaid" ? "MERMAID" : "HTML";
    const output = await prisma.output.findFirst({
      where: { processId: id, type, format: wantedFormat },
      orderBy: { createdAt: "desc" },
    });
    if (!output) throw new NotFoundError("Entregável ainda não foi gerado para este processo.");

    if (format === "pdf") {
      const pdf = await renderHtmlToPdf(output.content);
      return new NextResponse(pdf as unknown as BodyInit, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${basename}.pdf"`,
        },
      });
    }

    if (wantedFormat === "MERMAID") {
      return new NextResponse(output.content, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Content-Disposition": `attachment; filename="${basename}.mmd"`,
        },
      });
    }

    return new NextResponse(output.content, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="${basename}.html"`,
      },
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
