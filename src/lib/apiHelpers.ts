import { NextResponse } from "next/server";
import type { z } from "zod";
import { UnauthorizedError } from "./auth";

export function jsonError(status: number, message: string): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

export class NotFoundError extends Error {}
export class ForbiddenError extends Error {}
export class ValidationError extends Error {}

export async function parseJsonBody<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ValidationError("Invalid JSON body");
  }
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new ValidationError(result.error.issues.map((i) => i.message).join("; "));
  }
  return result.data;
}

/** Central error->HTTP mapping so every route handler stays a thin, testable function. */
export function handleRouteError(err: unknown): NextResponse {
  if (err instanceof UnauthorizedError) return jsonError(401, err.message);
  if (err instanceof ForbiddenError) return jsonError(403, err.message);
  if (err instanceof NotFoundError) return jsonError(404, err.message);
  if (err instanceof ValidationError) return jsonError(400, err.message);
  // eslint-disable-next-line no-console
  console.error(err);
  return jsonError(500, "Internal server error");
}
