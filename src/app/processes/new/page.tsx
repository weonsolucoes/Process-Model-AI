"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, ApiError } from "@/lib/apiClient";

interface CreateProcessResponse {
  process: { id: string };
}

export default function NewProcessPage() {
  const [name, setName] = useState("");
  const [area, setArea] = useState("");
  const [respondentRole, setRespondentRole] = useState("");
  const [initialDescription, setInitialDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { process } = await apiFetch<CreateProcessResponse>("/api/processes", {
        method: "POST",
        body: JSON.stringify({
          name,
          area: area || null,
          respondentRole: respondentRole || null,
          initialDescription: initialDescription || null,
        }),
      });
      router.push(`/processes/${process.id}/interview`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.push("/login");
        return;
      }
      setError(err instanceof ApiError ? err.message : "Erro ao criar processo");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page" style={{ maxWidth: 560 }}>
      <div className="steps-nav">
        <span className="active">1. Identificação</span>
        <span>2. Entrevista</span>
        <span>3. Validação</span>
        <span>4. Resultado</span>
      </div>
      <h1>Mapear Meu Processo</h1>
      <p style={{ color: "#64748b" }}>
        Antes de começar a conversa, só precisamos de um contexto rápido — nada de formulário
        extenso.
      </p>
      <form onSubmit={onSubmit} className="card">
        <div className="field">
          <label htmlFor="name">Nome do processo *</label>
          <input id="name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Compra de insumos" />
        </div>
        <div className="field">
          <label htmlFor="area">Área / departamento</label>
          <input id="area" value={area} onChange={(e) => setArea(e.target.value)} placeholder="Ex.: Compras" />
        </div>
        <div className="field">
          <label htmlFor="role">Sua função</label>
          <input id="role" value={respondentRole} onChange={(e) => setRespondentRole(e.target.value)} placeholder="Ex.: Analista de compras" />
        </div>
        <div className="field">
          <label htmlFor="desc">Breve descrição inicial (opcional)</label>
          <textarea
            id="desc"
            rows={3}
            value={initialDescription}
            onChange={(e) => setInitialDescription(e.target.value)}
            placeholder="Em poucas palavras, do que se trata esse processo?"
          />
        </div>
        {error && <p className="error-text">{error}</p>}
        <button type="submit" className="btn-primary" disabled={loading || !name}>
          {loading ? "Criando..." : "Iniciar entrevista"}
        </button>
      </form>
    </main>
  );
}
