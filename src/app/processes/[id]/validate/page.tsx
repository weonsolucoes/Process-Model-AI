"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch, ApiError } from "@/lib/apiClient";
import type { ProcessModel } from "@/domain/processModel";

interface ProcessDetail {
  process: { id: string; name: string; status: string; modelJson: ProcessModel };
}

interface ConfirmResponse {
  status: string;
  audit: { approved: boolean; missingCritical: string[]; summary: string };
}

export default function ValidatePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [model, setModel] = useState<ProcessModel | null>(null);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<ProcessDetail>(`/api/processes/${id}`)
      .then((data) => {
        setModel(data.process.modelJson);
        setStatus(data.process.status);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) router.push("/login");
        else setError("Não foi possível carregar o processo.");
      })
      .finally(() => setLoading(false));
  }, [id, router]);

  async function save(current: ProcessModel) {
    await apiFetch(`/api/processes/${id}/model`, { method: "PUT", body: JSON.stringify(current) });
  }

  async function onConfirm() {
    if (!model) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await save(model);
      const result = await apiFetch<ConfirmResponse>(`/api/processes/${id}/confirm`, { method: "POST" });
      if (result.status === "AUDITED") {
        router.push(`/processes/${id}/result`);
      } else {
        setNotice(
          `A auditoria encontrou pendências (${result.audit.missingCritical.join(", ")}). Voltando para a entrevista...`,
        );
        setTimeout(() => router.push(`/processes/${id}/interview`), 1800);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao confirmar");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <main className="page"><p>Carregando...</p></main>;
  if (!model) return <main className="page"><p className="error-text">{error}</p></main>;

  if (status !== "VALIDATION" && status !== "INTERVIEW") {
    return (
      <main className="page">
        <p>Este processo já passou da etapa de validação.</p>
        <a href={`/processes/${id}/result`} className="btn-primary">Ver resultado</a>
      </main>
    );
  }

  const openValidationPoints = model.validationPoints.filter((v) => !v.resolved);

  return (
    <main className="page">
      <div className="steps-nav">
        <span>1. Identificação</span>
        <span>2. Entrevista</span>
        <span className="active">3. Validação</span>
        <span>4. Resultado</span>
      </div>
      <h1>Vamos revisar o entendimento</h1>
      <p style={{ color: "#64748b" }}>Confira e corrija o que for necessário antes da auditoria.</p>

      <div className="card">
        <h2 className="card-title">Dados gerais</h2>
        <div className="field">
          <label>Objetivo</label>
          <input
            value={model.objective ?? ""}
            onChange={(e) => setModel({ ...model, objective: e.target.value || null })}
          />
        </div>
        <div className="field">
          <label>Responsável pelo processo</label>
          <input value={model.owner ?? ""} onChange={(e) => setModel({ ...model, owner: e.target.value || null })} />
        </div>
        <div className="field">
          <label>Gatilho / início</label>
          <input value={model.trigger ?? ""} onChange={(e) => setModel({ ...model, trigger: e.target.value || null })} />
        </div>
        <div className="field">
          <label>Encerramento / fim</label>
          <input value={model.endEvent ?? ""} onChange={(e) => setModel({ ...model, endEvent: e.target.value || null })} />
        </div>
      </div>

      <div className="card">
        <h2 className="card-title">Fluxo ({model.steps.length} etapas)</h2>
        {model.steps.length === 0 && <p className="empty">Nenhuma etapa registrada ainda.</p>}
        {model.steps.map((step, idx) => (
          <div key={step.id} style={{ borderTop: idx > 0 ? "1px solid #e2e8f0" : undefined, paddingTop: idx > 0 ? "0.75rem" : 0, marginTop: idx > 0 ? "0.75rem" : 0 }}>
            <div className="field">
              <label>Etapa {idx + 1}</label>
              <input
                value={step.activity}
                onChange={(e) => {
                  const steps = [...model.steps];
                  steps[idx] = { ...step, activity: e.target.value };
                  setModel({ ...model, steps });
                }}
              />
            </div>
            <div className="field">
              <label>Responsável</label>
              <input
                value={step.responsible ?? ""}
                onChange={(e) => {
                  const steps = [...model.steps];
                  steps[idx] = { ...step, responsible: e.target.value || null };
                  setModel({ ...model, steps });
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {model.decisions.length > 0 && (
        <div className="card">
          <h2 className="card-title">Decisões</h2>
          <ul>
            {model.decisions.map((d) => (
              <li key={d.id}>
                <strong>{d.condition}</strong>: {d.paths.map((p) => p.label).join(" / ")}
              </li>
            ))}
          </ul>
        </div>
      )}

      {openValidationPoints.length > 0 && (
        <div className="card">
          <h2 className="card-title">Pontos a validar</h2>
          <ul>
            {openValidationPoints.map((v, idx) => (
              <li key={v.id}>
                <label style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
                  <input
                    type="checkbox"
                    style={{ width: "auto", marginTop: "0.2rem" }}
                    onChange={() => {
                      const validationPoints = model.validationPoints.map((vp) =>
                        vp.id === v.id ? { ...vp, resolved: true } : vp,
                      );
                      setModel({ ...model, validationPoints });
                    }}
                  />
                  <span>
                    <strong>{v.field}</strong>: {v.description}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && <p className="error-text">{error}</p>}
      {notice && <p>{notice}</p>}

      <button className="btn-primary" onClick={onConfirm} disabled={saving}>
        {saving ? "Processando..." : "Confirmar e auditar"}
      </button>
    </main>
  );
}
