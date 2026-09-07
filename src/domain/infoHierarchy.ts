/**
 * The three-tier information hierarchy from spec §10. Level 1 fields are
 * checked deterministically (see lib/interview/completeness.ts) so that
 * "is the interview done yet" never depends solely on an LLM's opinion —
 * it is a hybrid: the AI proposes finishing, code verifies the hard floor.
 */
export const ESSENTIAL_TOPICS = [
  "gatilho/início",
  "fluxo principal",
  "responsáveis",
  "decisões relevantes",
  "caminhos das decisões",
  "encerramento/fim",
] as const;

export const RELEVANT_TOPICS = [
  "entradas",
  "saídas",
  "sistemas",
  "ferramentas",
  "documentos",
  "regras de negócio",
  "exceções",
  "interfaces entre áreas",
  "aprovações",
  "handoffs",
] as const;

export const CONTEXTUAL_TOPICS_EXAMPLES = [
  "quem criou uma planilha",
  "história de determinada ferramenta",
  "informações históricas sem impacto no processo",
  "detalhes administrativos sem impacto na compreensão",
] as const;

/** Ambiguous phrasing the AI Auditor must flag when it matters (spec §31). */
export const AMBIGUITY_MARKERS = [
  "alguém aprova",
  "alguem aprova",
  "depois verificam",
  "se necessário",
  "se necessario",
  "o pessoal faz",
  "normalmente alguém",
  "normalmente alguem",
] as const;
