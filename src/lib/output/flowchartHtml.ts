import type { ProcessModel } from "@/domain/processModel";
import { escapeHtml } from "./htmlTemplate";
import { generateFlowchartMermaid } from "./flowchart";

/**
 * Standalone, downloadable HTML export of the flowchart. Loads Mermaid
 * from a public CDN so the exported file works when opened directly in
 * any browser (this file is downloaded by the end user, not rendered
 * inside our own app sandbox — the in-app viewer instead bundles Mermaid
 * normally through Next.js, see components/FlowchartView).
 */
export function generateFlowchartHtml(model: ProcessModel): string {
  const definition = generateFlowchartMermaid(model);
  const title = `Fluxograma — ${model.identification.processName}`;

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<script src="https://cdn.jsdelivr.net/npm/mermaid@11.17.2/dist/mermaid.min.js"></script>
<style>
  body { font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 2rem; color: #1f2937; }
  h1 { font-size: 1.4rem; }
  .mermaid { margin-top: 1.5rem; }
</style>
</head>
<body>
<h1>${escapeHtml(title)}</h1>
<pre class="mermaid">
${definition}
</pre>
<script>mermaid.initialize({ startOnLoad: true, securityLevel: "strict" });</script>
</body>
</html>`;
}
