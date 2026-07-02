export interface DemoContext {
  empresa: string;
  ejercicio: number;
  periodo: string;
  version: string;
  usuario: string;
}

export interface ApiErrorResponse {
  code: string;
  message: string;
  details?: unknown;
}

export type DataOrigin = "PUBLICO_REAL" | "DERIVADO" | "SINTETICO_PRUEBA";
