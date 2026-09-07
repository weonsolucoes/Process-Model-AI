import { createEmptyProcessModel, type Identification } from "@/domain/processModel";

export function makeIdentification(overrides: Partial<Identification> = {}): Identification {
  return {
    processName: "Compra de insumos",
    area: "Compras",
    respondentRole: "Analista",
    initialDescription: null,
    ...overrides,
  };
}

export function makeEmptyModel(overrides: Partial<Identification> = {}) {
  return createEmptyProcessModel(makeIdentification(overrides));
}
