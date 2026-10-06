// Pure grading / rules helpers shared by server functions and tests.
export type QType = "unica" | "multipla" | "vf" | "curta" | "longa" | "escala";

export interface GradeResult {
  is_correct: boolean | null;
  score_awarded: number | null;
  needs_review: boolean;
}

export function gradeAnswer(type: QType, points: number, correct: unknown, answer: unknown): GradeResult {
  const empty = answer === null || answer === undefined || answer === "" || (Array.isArray(answer) && answer.length === 0);
  if (type === "escala" || points <= 0) return { is_correct: null, score_awarded: null, needs_review: false };
  if (type === "curta" || type === "longa") {
    if (empty) return { is_correct: false, score_awarded: 0, needs_review: false };
    return { is_correct: null, score_awarded: null, needs_review: true };
  }
  if (correct === null || correct === undefined) return { is_correct: null, score_awarded: null, needs_review: true };
  if (empty) return { is_correct: false, score_awarded: 0, needs_review: false };
  let ok: boolean;
  if (type === "multipla") {
    const a = new Set(Array.isArray(answer) ? (answer as string[]) : []);
    const c = new Set(Array.isArray(correct) ? (correct as string[]) : []);
    ok = a.size === c.size && [...a].every((x) => c.has(x));
  } else {
    ok = answer === correct;
  }
  return { is_correct: ok, score_awarded: ok ? points : 0, needs_review: false };
}

/** attemptLimit 0 = unlimited */
export function canAttempt(completedAttempts: number, attemptLimit: number): boolean {
  if (attemptLimit <= 0) return true;
  return completedAttempts < attemptLimit;
}

/** Grade on a 0–10 scale. */
export function toTen(score: number | null | undefined, max: number | null | undefined): number | null {
  if (score == null || !max) return null;
  return Math.round((score / max) * 100) / 10;
}

export function normalizeCode(code: string): string {
  return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function randomCode(len = 6): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export const TYPE_LABEL: Record<string, string> = {
  prova: "Prova", atividade: "Atividade", questionario: "Questionário", diagnostico: "Diagnóstico",
};
export const QTYPE_LABEL: Record<QType, string> = {
  unica: "Múltipla escolha", multipla: "Caixas de seleção", vf: "Verdadeiro/Falso",
  curta: "Resposta curta", longa: "Resposta longa", escala: "Escala 1–5",
};
export const ROOM_STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho", ativa: "Ativa", encerrada: "Encerrada", arquivada: "Arquivada",
};
