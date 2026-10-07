import { describe, it, expect } from "vitest";
import { canAttempt, gradeAnswer, normalizeCode, toTen, textSimilarity, normalizeText, gradeShortAnswer } from "./grading";

describe("regras", () => {
  it("1 tentativa: bloqueia após uma concluída", () => {
    expect(canAttempt(0, 1)).toBe(true);
    expect(canAttempt(1, 1)).toBe(false);
  });
  it("3 tentativas permite a terceira e bloqueia a quarta", () => {
    expect(canAttempt(2, 3)).toBe(true);
    expect(canAttempt(3, 3)).toBe(false);
  });
  it("ilimitadas (0) sempre permite", () => {
    expect(canAttempt(50, 0)).toBe(true);
  });
  it("múltipla exige o conjunto exato", () => {
    expect(gradeAnswer("multipla", 3, ["a", "b"], ["b", "a"]).score_awarded).toBe(3);
    expect(gradeAnswer("multipla", 3, ["a", "b"], ["a"]).score_awarded).toBe(0);
  });
  it("resposta dissertativa longa vai para correção manual", () => {
    expect(gradeAnswer("longa", 2, null, "texto").needs_review).toBe(true);
  });
  it("código é normalizado em maiúsculas", () => {
    expect(normalizeCode(" info26 ")).toBe("INFO26");
  });
  it("nota em escala 0–10", () => {
    expect(toTen(7, 10)).toBe(7);
  });
});

describe("autocorreção de resposta curta", () => {
  it("normalizeText remove acentos e pontuação", () => {
    expect(normalizeText("Fotossíntese!")).toBe("fotossintese");
    expect(normalizeText("  ÁGUA   ")).toBe("agua");
  });

  it("textSimilarity: strings idênticas = 1", () => {
    expect(textSimilarity("fotossíntese", "fotossíntese")).toBe(1);
  });

  it("textSimilarity: strings muito diferentes < 0.3", () => {
    expect(textSimilarity("fotossíntese", "xyz")).toBeLessThan(0.3);
  });

  it("resposta curta exata → nota cheia, sem revisão", () => {
    const r = gradeAnswer("curta", 2, "fotossíntese", "fotossíntese");
    expect(r.score_awarded).toBe(2);
    expect(r.needs_review).toBe(false);
    expect(r.is_correct).toBe(true);
  });

  it("resposta curta quase certa (≥75%) → nota cheia, sem revisão", () => {
    const r = gradeAnswer("curta", 2, "fotossíntese", "fotossintese");
    expect(r.score_awarded).toBe(2);
    expect(r.needs_review).toBe(false);
  });

  it("gradeShortAnswer moderada (50%–74%) → metade, sem revisão", () => {
    const r = gradeShortAnswer(2, "respiração celular aeróbica", "respiração");
    expect(r.needs_review).toBe(false);
    expect(r.similarity).toBeGreaterThanOrEqual(0.50);
  });

  it("resposta curta muito diferente (<30%) → 0 pontos, revisão", () => {
    const r = gradeAnswer("curta", 2, "fotossíntese", "cachorro");
    expect(r.score_awarded).toBe(0);
    expect(r.needs_review).toBe(true);
  });

  it("resposta curta sem gabarito → revisão manual", () => {
    const r = gradeAnswer("curta", 2, null, "qualquer coisa");
    expect(r.needs_review).toBe(true);
    expect(r.score_awarded).toBeNull();
  });

  it("resposta curta em branco → 0 pontos, sem revisão", () => {
    const r = gradeAnswer("curta", 2, "fotossíntese", "");
    expect(r.score_awarded).toBe(0);
    expect(r.needs_review).toBe(false);
  });
});
