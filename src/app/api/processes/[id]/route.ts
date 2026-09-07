import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/auth";
import { handleRouteError } from "@/lib/apiHelpers";
import { loadOwnedProcess } from "@/lib/processService";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const process = await loadOwnedProcess(userId, id);
    const messages = await prisma.message.findMany({
      where: { processId: id },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({ process, messages });
  } catch (err) {
    return handleRouteError(err);
  }
}
