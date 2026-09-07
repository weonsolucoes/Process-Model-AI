"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch, ApiError } from "@/lib/apiClient";
import { MermaidView } from "@/components/MermaidView";

interface ProcessDetail {
  process: { id: string; name: string; status: string };
}

interface OutputRow {
  id: string;
  content: string;
}

interface OutputsResponse {
  asIs: OutputRow | null;
  diagnosis: OutputRow | null;
  quickWins: OutputRow | null;
  flowchartMermaid: OutputRow | null;
}

interface GenerateResponse {
  status: string;
  outputs: {
    asIsHtml: string;
    diagnosisHtml: string;
    quickWinsHtml: string;
    flowchartMermaid: string;
  };
}

export default function ResultPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outputs, setOutputs] = useState<{
    asIsHtml: string;
    diagnosisHtml: string;
    quickWinsHtml: string;
    flowchartMermaid: string;
  } | null>(null);

  useEffect(() => {
    apiFetch<ProcessDetail>(`/api/processes/${id}`)
      .then(async (data) => {
        setStatus(data.process.status);
        if (data.process.status === "COMPLETED") {
          const res = await apiFetch<OutputsResponse>(`/api/processes/${id}/outputs`);
          setOutputs({
            asIsHtml: res.asIs?.content ?? "",
            diagnosisHtml: res.diagnosis?.content ?? "",
            quickWinsHtml: res.quickWins?.content ?? "",
            flowchartMermaid: res.flowchartMermaid?.content ?? "",
          });
        }
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) router.push("/login");
        else setError("Não foi possível carregar o processo.");
      })
      .finally(() => setLoading(false));
  }, [id, router]);

  async function generate() {
    setGenerating(true);
    setError(null);
    try {
      const result = await apiFetch<GenerateResponse>(`/api/processes/${id}/generate`, { method: "POST" });
      setStatus(result.status);
      setOutputs(result.outputs);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao gerar entregáveis");
    } finally {
      setGenerating(false);
    }
  }

  if (loading) return <main className="page"><p>Carregando...</p></main>;

  return (
    <main className="page">
      <div className="steps-nav">
        <span>1. Identificação</span>
        <span>2. Entrevista</span>
        <span>3. Validação</span>
        <span className="active">4. Resultado</span>
      </div>
      <h1>Resultado</h1>

      {status === "AUDITED" && (
        <div className="card">
          <p>O processo foi auditado e aprovado. Gere os entregáveis para visualizar e exportar.</p>
          <button className="btn-primary" onClick={generate} disabled={generating}>
            {generating ? "Gerando..." : "Gerar entregáveis"}
          </button>
          {error && <p className="error-text">{error}</p>}
        </div>
      )}

      {(status === "INTERVIEW" || status === "VALIDATION") && (
        <div className="card">
          <p>Este processo ainda não chegou à etapa de geração de entregáveis.</p>
          <a href={`/processes/${id}/interview`} className="btn-primary">Continuar entrevista</a>
        </div>
      )}

      {outputs && (
        <>
          <div className="card">
            <h2 className="card-title">
              Fluxograma <ExportLinks id={id} type="flowchart" />
            </h2>
            <MermaidView definition={outputs.flowchartMermaid} />
          </div>

          <ReportCard title="AS IS" html={outputs.asIsHtml} exportProps={{ id, type: "as-is" }} />
          <ReportCard title="Diagnóstico" html={outputs.diagnosisHtml} exportProps={{ id, type: "diagnosis" }} />
          <ReportCard title="Quick Wins" html={outputs.quickWinsHtml} exportProps={{ id, type: "quick-wins" }} />
        </>
      )}
    </main>
  );
}

function ReportCard({
  title,
  html,
  exportProps,
}: {
  title: string;
  html: string;
  exportProps: { id: string; type: string };
}) {
  return (
    <div className="card">
      <h2 className="card-title">
        {title} <ExportLinks id={exportProps.id} type={exportProps.type} />
      </h2>
      <iframe
        srcDoc={html}
        title={title}
        style={{ width: "100%", height: 480, border: "1px solid #e2e8f0", borderRadius: 8 }}
      />
    </div>
  );
}

function ExportLinks({ id, type }: { id: string; type: string }) {
  const formats = type === "flowchart" ? ["html", "mermaid"] : ["html", "pdf"];
  return (
    <span style={{ fontSize: "0.8rem", fontWeight: 400 }}>
      {formats.map((f, i) => (
        <span key={f}>
          {i > 0 && " · "}
          <a href={`/api/processes/${id}/export/${type}?format=${f}`}>{f.toUpperCase()}</a>
        </span>
      ))}
    </span>
  );
}
