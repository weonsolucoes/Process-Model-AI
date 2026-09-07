import Link from "next/link";

export default function HomePage() {
  return (
    <main className="page">
      <h1>WeOn AI Process</h1>
      <p style={{ color: "#64748b", maxWidth: 640 }}>
        Transforme uma conversa sobre um processo real em um material profissional: AS IS,
        fluxograma, diagnóstico e quick wins — conduzido por uma entrevista inteligente.
      </p>

      <div className="card">
        <h2 className="card-title">Mapear Meu Processo</h2>
        <p className="card-desc">
          Descreva um processo do seu negócio e deixe a IA conduzir a entrevista, estruturar o
          entendimento e gerar os entregáveis.
        </p>
        <Link href="/processes/new" className="btn btn-primary">
          Começar
        </Link>
      </div>

      <div className="card" style={{ opacity: 0.7 }}>
        <h2 className="card-title">
          Diagnosticar Minha Operação <span className="badge badge-locked">em breve</span>
        </h2>
        <p className="card-desc">Fora do escopo do MVP atual.</p>
      </div>

      <div className="card" style={{ opacity: 0.7 }}>
        <h2 className="card-title">
          Criar Meu Onboarding <span className="badge badge-locked">em breve</span>
        </h2>
        <p className="card-desc">Fora do escopo do MVP atual.</p>
      </div>
    </main>
  );
}
