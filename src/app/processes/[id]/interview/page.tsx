"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch, ApiError } from "@/lib/apiClient";

interface ChatMessage {
  id: string;
  role: "USER" | "ASSISTANT" | "SYSTEM";
  content: string;
}

interface ProcessDetail {
  process: { id: string; name: string; status: string };
  messages: ChatMessage[];
}

interface TurnResponse {
  assistantMessage: string;
  interviewComplete: boolean;
  status: string;
}

export default function InterviewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<string>("INTERVIEW");
  const [processName, setProcessName] = useState("");
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    apiFetch<ProcessDetail>(`/api/processes/${id}`)
      .then((data) => {
        setMessages(data.messages);
        setStatus(data.process.status);
        setProcessName(data.process.name);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) router.push("/login");
        else setError("Não foi possível carregar o processo.");
      })
      .finally(() => setLoading(false));
  }, [id, router]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    if (!input.trim() || sending) return;
    const content = input.trim();
    setInput("");
    setError(null);
    setMessages((prev) => [...prev, { id: `local-${Date.now()}`, role: "USER", content }]);
    setSending(true);
    try {
      const result = await apiFetch<TurnResponse>(`/api/processes/${id}/messages`, {
        method: "POST",
        body: JSON.stringify({ content }),
      });
      setMessages((prev) => [
        ...prev,
        { id: `local-${Date.now()}-a`, role: "ASSISTANT", content: result.assistantMessage },
      ]);
      setStatus(result.status);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao enviar mensagem");
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <main className="page">
        <p>Carregando...</p>
      </main>
    );
  }

  const interviewOpen = status === "INTERVIEW";

  return (
    <main className="page">
      <div className="steps-nav">
        <span>1. Identificação</span>
        <span className="active">2. Entrevista</span>
        <span>3. Validação</span>
        <span>4. Resultado</span>
      </div>
      <h1>{processName}</h1>

      {!interviewOpen && (
        <div className="card" style={{ borderColor: "#1e3a5f" }}>
          <p style={{ margin: 0 }}>
            A entrevista foi concluída. Vamos revisar juntos o entendimento antes de gerar os
            materiais.
          </p>
          <a href={`/processes/${id}/validate`} className="btn-primary" style={{ display: "inline-block", marginTop: "0.75rem" }}>
            Ir para validação
          </a>
        </div>
      )}

      <div className="card">
        <div className="chat-log">
          {messages
            .filter((m) => m.role !== "SYSTEM")
            .map((m) => (
              <div key={m.id} className={`chat-bubble ${m.role === "USER" ? "user" : "assistant"}`}>
                {m.content}
              </div>
            ))}
          <div ref={bottomRef} />
        </div>

        {interviewOpen && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            style={{ display: "flex", gap: "0.5rem" }}
          >
            <textarea
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="Responda aqui..."
              disabled={sending}
            />
            <button type="submit" className="btn-primary" disabled={sending || !input.trim()}>
              {sending ? "..." : "Enviar"}
            </button>
          </form>
        )}
        {error && <p className="error-text">{error}</p>}
      </div>
    </main>
  );
}
