import { describe, it, expect } from "vitest";
import { canAttempt, gradeAnswer, normalizeCode, toTen } from "./grading";

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
  it("resposta aberta pontuada vai para correção manual", () => {
    expect(gradeAnswer("longa", 2, null, "texto").needs_review).toBe(true);
  });
  it("código é normalizado em maiúsculas", () => {
    expect(normalizeCode(" info26 ")).toBe("INFO26");
  });
  it("nota em escala 0–10", () => {
    expect(toTen(7, 10)).toBe(7);
  });
});
