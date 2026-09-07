import type { ProcessModel } from "@/domain/processModel";
import { generateAsIsHtml } from "./asis";
import { generateDiagnosisHtml } from "./diagnosis";
import { generateFlowchartMermaid } from "./flowchart";
import { generateFlowchartHtml } from "./flowchartHtml";
import { generateQuickWinsHtml } from "./quickwins";

export interface GeneratedOutputs {
  asIsHtml: string;
  diagnosisHtml: string;
  quickWinsHtml: string;
  flowchartMermaid: string;
  flowchartHtml: string;
}

/**
 * Output Engine entry point (spec §25). Every function here is a pure
 * projection of the Process Model — no AI call happens at generation time,
 * so the deliverables can never drift from what the interview + audit
 * actually established.
 */
export function generateAllOutputs(model: ProcessModel): GeneratedOutputs {
  return {
    asIsHtml: generateAsIsHtml(model),
    diagnosisHtml: generateDiagnosisHtml(model),
    quickWinsHtml: generateQuickWinsHtml(model),
    flowchartMermaid: generateFlowchartMermaid(model),
    flowchartHtml: generateFlowchartHtml(model),
  };
}

export { generateAsIsHtml, generateDiagnosisHtml, generateQuickWinsHtml, generateFlowchartMermaid, generateFlowchartHtml };
export { renderHtmlToPdf } from "./pdf";
