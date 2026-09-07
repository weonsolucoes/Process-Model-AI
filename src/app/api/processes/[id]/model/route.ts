import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/auth";
import { handleRouteError, ValidationError } from "@/lib/apiHelpers";
import { loadOwnedProcess } from "@/lib/processService";
import { ProcessModelSchema } from "@/domain/processModel";

/**
 * Spec §30 — user validation/correction step. The client fetches the
 * current Process Model, lets the user edit it, and PUTs the corrected
 * object back; the server re-validates it with the same Zod schema that
 * governs every other write path, so a correction can't smuggle in a
 * shape the rest of the system doesn't understand.
 */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const process = await loadOwnedProcess(userId, id);

    if (process.status !== "VALIDATION" && process.status !== "INTERVIEW") {
      throw new ValidationError("O processo não está em etapa de validação.");
    }

    const body = await request.json().catch(() => {
      throw new ValidationError("Invalid JSON body");
    });
    const result = ProcessModelSchema.safeParse(body);
    if (!result.success) {
      throw new ValidationError(result.error.issues.map((i) => i.message).join("; "));
    }

    const updated = await prisma.process.update({
      where: { id },
      data: { modelJson: result.data },
    });

    return NextResponse.json({ process: updated });
  } catch (err) {
    return handleRouteError(err);
  }
}
