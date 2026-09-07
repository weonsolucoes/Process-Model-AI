import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/auth";
import { handleRouteError } from "@/lib/apiHelpers";
import { loadOwnedProcess } from "@/lib/processService";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    await loadOwnedProcess(userId, id);

    const outputs = await prisma.output.findMany({
      where: { processId: id },
      orderBy: { createdAt: "desc" },
    });

    const latest = (type: string, format: string) =>
      outputs.find((o) => o.type === type && o.format === format) ?? null;

    return NextResponse.json({
      asIs: latest("AS_IS", "HTML"),
      diagnosis: latest("DIAGNOSIS", "HTML"),
      quickWins: latest("QUICK_WINS", "HTML"),
      flowchartMermaid: latest("FLOWCHART", "MERMAID"),
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
