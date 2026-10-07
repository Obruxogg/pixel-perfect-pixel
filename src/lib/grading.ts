// Pure grading / rules helpers shared by server functions and tests.
export type QType = "unica" | "multipla" | "vf" | "curta" | "longa" | "escala";

export interface GradeResult {
  is_correct: boolean | null;
  score_awarded: number | null;
  needs_review: boolean;
  /** For short-answer: 0–1 similarity score when auto-graded */
  similarity?: number;
}

/**
 * Normalize text for comparison: lowercase, trim, remove accents,
 * collapse multiple spaces, strip punctuation.
 */
export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Levenshtein distance between two strings (character-level).
 * Returns 0 for equal strings.
 */
export function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[][] = [];
  for (let i = 0; i <= m; i++) dp[i] = [i];
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

/**
 * Returns similarity ratio (0–1) between two normalized strings.
 * 1 = identical, 0 = completely different.
 */
export function textSimilarity(a: string, b: string): number {
  const na = normalizeText(a);
  const nb = normalizeText(b);
  if (na === nb) return 1;
  if (!na || !nb) return 0;
  const maxLen = Math.max(na.length, nb.length);
  return 1 - levenshtein(na, nb) / maxLen;
}

/** Thresholds for short-answer auto-grading */
export const SHORT_ANSWER_FULL_THRESHOLD = 0.75;  // ≥ 75% → full score
export const SHORT_ANSWER_PARTIAL_THRESHOLD = 0.50; // ≥ 50% → half score, no review
export const SHORT_ANSWER_REVIEW_THRESHOLD = 0.30;  // ≥ 30% → half score, flag for review

/**
 * Auto-grade a short-answer question when a correct key is provided.
 * Returns null if no expected answer is given (falls back to manual).
 */
export function gradeShortAnswer(
  points: number,
  correct: string,
  answer: string,
): GradeResult & { similarity: number } {
  const sim = textSimilarity(correct, answer);
  // If the answer is a substring of the correct answer (or vice‑versa) after normalization,
  // treat it as a moderate match even if the raw similarity score is slightly below the threshold.
  const normCorrect = normalizeText(correct);
  const normAnswer = normalizeText(answer);
  const isSubstring =
    normCorrect.includes(normAnswer) || normAnswer.includes(normCorrect);

  if (sim >= SHORT_ANSWER_FULL_THRESHOLD) {
    return { is_correct: true, score_awarded: points, needs_review: false, similarity: sim };
  }
  if (sim >= SHORT_ANSWER_PARTIAL_THRESHOLD || isSubstring) {
    // Close enough — award half points, mark as auto‑graded (no review needed)
    return { is_correct: false, score_awarded: Math.round(points * 0.5 * 100) / 100, needs_review: false, similarity: sim };
  }
  if (sim >= SHORT_ANSWER_REVIEW_THRESHOLD) {
    // Marginal — award half points but flag for teacher review
    return { is_correct: null, score_awarded: Math.round(points * 0.5 * 100) / 100, needs_review: true, similarity: sim };
  }
  // Too different — 0 points, flag for review so teacher can override
  return { is_correct: false, score_awarded: 0, needs_review: true, similarity: sim };
}

export function gradeAnswer(type: QType, points: number, correct: unknown, answer: unknown): GradeResult {
  const empty = answer === null || answer === undefined || answer === "" || (Array.isArray(answer) && answer.length === 0);
  if (type === "escala" || points <= 0) return { is_correct: null, score_awarded: null, needs_review: false };
  if (type === "longa") {
    // Long-form answers always go to manual review
    if (empty) return { is_correct: false, score_awarded: 0, needs_review: false };
    return { is_correct: null, score_awarded: null, needs_review: true };
  }
  if (type === "curta") {
    if (empty) return { is_correct: false, score_awarded: 0, needs_review: false };
    // If teacher provided an expected answer, auto-grade by similarity
    if (correct !== null && correct !== undefined && String(correct).trim()) {
      return gradeShortAnswer(points, String(correct), String(answer));
    }
    // No expected answer → manual review
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
