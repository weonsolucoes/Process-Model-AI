import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { InterviewTurnResultSchema } from "@/domain/interviewTypes";
import { AuditResultSchema } from "@/domain/auditTypes";
import { buildAuditSystemPrompt, buildAuditUserPrompt } from "@/lib/auditor/prompts";
import { buildInterviewSystemPrompt, buildInterviewUserPrompt } from "@/lib/interview/prompts";
import type {
  AIProvider,
  AuditResponse,
  InterviewTurnRequest,
  InterviewTurnResponse,
} from "./provider";
import { AIProviderError } from "./provider";

const INTERVIEW_TOOL_NAME = "submit_interview_turn";
const AUDIT_TOOL_NAME = "submit_audit";

// Zod v4 -> JSON Schema keeps Anthropic's tool input_schema in lockstep with
// the domain types instead of a hand-maintained duplicate (spec §38: the
// model must be swappable without rewriting the product).
function toToolSchema(schema: z.ZodTypeAny) {
  const jsonSchema = z.toJSONSchema(schema, { target: "draft-7" }) as Record<string, unknown>;
  delete jsonSchema.$schema;
  return jsonSchema;
}

export class AnthropicProvider implements AIProvider {
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model: string) {
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }

  async runInterviewTurn(req: InterviewTurnRequest): Promise<InterviewTurnResponse> {
    const system = buildInterviewSystemPrompt();
    const user = buildInterviewUserPrompt(req.processModel, req.history, req.latestUserMessage);
    const { parsed, usage } = await this.callTool(
      system,
      user,
      INTERVIEW_TOOL_NAME,
      "Registra o resultado estruturado de um turno da entrevista.",
      InterviewTurnResultSchema,
    );
    return { result: parsed, usage, model: this.model };
  }

  async runAudit(processModel: Parameters<AIProvider["runAudit"]>[0]): Promise<AuditResponse> {
    const system = buildAuditSystemPrompt();
    const user = buildAuditUserPrompt(processModel);
    const { parsed, usage } = await this.callTool(
      system,
      user,
      AUDIT_TOOL_NAME,
      "Registra o resultado estruturado da auditoria.",
      AuditResultSchema,
    );
    return { result: parsed, usage, model: this.model };
  }

  private async callTool<T>(
    system: string,
    userPrompt: string,
    toolName: string,
    toolDescription: string,
    schema: z.ZodType<T>,
  ): Promise<{ parsed: T; usage: { promptTokens: number; completionTokens: number } }> {
    const tool = {
      name: toolName,
      description: toolDescription,
      input_schema: toToolSchema(schema) as Anthropic.Tool.InputSchema,
    };

    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const message = await this.client.messages.create({
          model: this.model,
          max_tokens: 4096,
          system,
          tools: [tool],
          tool_choice: { type: "tool", name: toolName },
          messages: [{ role: "user", content: userPrompt }],
        });

        const toolUse = message.content.find(
          (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
        );
        if (!toolUse) {
          throw new AIProviderError("Model did not return a tool_use block");
        }

        const parsed = schema.parse(toolUse.input);
        return {
          parsed,
          usage: {
            promptTokens: message.usage.input_tokens,
            completionTokens: message.usage.output_tokens,
          },
        };
      } catch (err) {
        lastError = err;
      }
    }
    throw new AIProviderError(`AI call to ${toolName} failed after retry`, lastError);
  }
}

export function createAnthropicProvider(): AnthropicProvider {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new AIProviderError("ANTHROPIC_API_KEY is not set");
  }
  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5";
  return new AnthropicProvider(apiKey, model);
}
