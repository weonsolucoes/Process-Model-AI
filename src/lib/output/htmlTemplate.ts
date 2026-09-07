/** Shared, minimal HTML shell for exportable deliverables (spec §42: professional, simple, not marketing). */
export function wrapReportHtml(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 2.5rem 3rem;
    background: #ffffff;
    color: #1f2937;
    font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    line-height: 1.5;
  }
  h1 { font-size: 1.6rem; margin: 0 0 0.25rem; }
  h2 { font-size: 1.15rem; margin: 2rem 0 0.5rem; border-bottom: 1px solid #e5e7eb; padding-bottom: 0.35rem; }
  .subtitle { color: #6b7280; margin: 0 0 1.5rem; font-size: 0.95rem; }
  table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
  th, td { text-align: left; padding: 0.5rem 0.6rem; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
  th { background: #f9fafb; font-weight: 600; }
  .badge { display: inline-block; padding: 0.1rem 0.5rem; border-radius: 999px; font-size: 0.75rem; font-weight: 600; }
  .badge-fact { background: #fee2e2; color: #991b1b; }
  .badge-hypothesis { background: #fef3c7; color: #92400e; }
  .empty { color: #9ca3af; font-style: italic; }
  ul { margin: 0.25rem 0; padding-left: 1.25rem; }
  .meta { color: #6b7280; font-size: 0.85rem; }
</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
