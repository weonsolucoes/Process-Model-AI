"use client";

import { useEffect, useRef, useState } from "react";

/** Renders a Mermaid definition client-side via the bundled npm package (spec §41: view results in-app). */
export function MermaidView({ definition }: { definition: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function render() {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({ startOnLoad: false, securityLevel: "strict" });
        const { svg } = await mermaid.render(`flowchart-${Date.now()}`, definition);
        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = svg;
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Erro ao renderizar fluxograma");
      }
    }
    render();
    return () => {
      cancelled = true;
    };
  }, [definition]);

  if (error) return <p className="error-text">{error}</p>;
  return <div ref={containerRef} style={{ overflowX: "auto" }} />;
}
