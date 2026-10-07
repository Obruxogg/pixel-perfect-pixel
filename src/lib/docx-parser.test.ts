import { describe, it, expect } from "vitest";
import { parseQuestionsFromText, parseGabaritoOnlyText } from "./docx-parser";

describe("DOCX & Text Question Parser", () => {
  it("extrai questões de múltipla escolha com gabarito asterisco", () => {
    const raw = `
    1. Qual comando salva no Excel?
    a) CTRL+S
    b) CTRL+B*
    c) CTRL+P
    d) CTRL+Z
    `;
    const qs = parseQuestionsFromText(raw);
    expect(qs.length).toBe(1);
    expect(qs[0].prompt).toContain("Qual comando salva no Excel?");
    expect(qs[0].options.length).toBe(4);
    expect(qs[0].correct).toBe("b");
    expect(qs[0].type).toBe("unica");
  });

  it("extrai questões com linha de Gabarito explícito", () => {
    const raw = `
    Questão 2: O que significa CPU?
    A) Central Processing Unit
    B) Computer Personal Unit
    C) Central Program Utility
    Gabarito: A
    `;
    const qs = parseQuestionsFromText(raw);
    expect(qs.length).toBe(1);
    expect(qs[0].correct).toBe("a");
  });

  it("identifica questões Verdadeiro ou Falso", () => {
    const raw = `
    3. (V) O teclado é periférico de entrada.
    (F) O monitor é periférico de entrada.
    `;
    const qs = parseQuestionsFromText(raw);
    expect(qs.length).toBe(1);
    expect(qs[0].type).toBe("vf");
    expect(qs[0].options.length).toBe(2);
  });

  it("identifica questões abertas e dissertativas", () => {
    const raw = `
    4. Explique o conceito de backup na nuvem.
    `;
    const qs = parseQuestionsFromText(raw);
    expect(qs.length).toBe(1);
    expect(qs[0].type).toBe("longa");
  });

  it("extrai gabarito de texto para questão de resposta curta / preencher", () => {
    const raw = `
    5. Qual é a capital do Brasil?
    Gabarito: Brasília
    `;
    const qs = parseQuestionsFromText(raw);
    expect(qs.length).toBe(1);
    expect(qs[0].type).toBe("curta");
    expect(qs[0].correct).toBe("Brasília");
  });

  it("converte XML de Word em parágrafos de texto legíveis", async () => {
    const { extractTextFromDocx } = await import("./docx-parser");
    const mockWordXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
      <w:body>
        <w:p><w:r><w:t>1. Qual a função do processador?</w:t></w:r></w:p>
        <w:p><w:r><w:t>a) Executar instruções*</w:t></w:r></w:p>
        <w:p><w:r><w:t>b) Armazenar energia</w:t></w:r></w:p>
      </w:body>
    </w:document>`;

    const encoder = new TextEncoder();
    const arrayBuffer = encoder.encode(mockWordXml).buffer;
    const text = await extractTextFromDocx(arrayBuffer);
    expect(text).toContain("1. Qual a função do processador?");
    expect(text).toContain("a) Executar instruções*");
    expect(text).toContain("b) Armazenar energia");

    const qs = parseQuestionsFromText(text);
    expect(qs.length).toBe(1);
    expect(qs[0].prompt).toContain("Qual a função do processador?");
    expect(qs[0].correct).toBe("a");
  });
  it("extrai gabarito isolado de texto ou lista de respostas", () => {
    const raw = `
    1. B
    2. C
    3. Gerenciar o computador, seus recursos, programas e dispositivos.
    4. Ctrl + C
    5. V
    `;
    const g = parseGabaritoOnlyText(raw);
    expect(g.length).toBe(5);
    expect(g[0]).toEqual({ questionNumber: 1, correct: "b" });
    expect(g[1]).toEqual({ questionNumber: 2, correct: "c" });
    expect(g[2]).toEqual({ questionNumber: 3, correct: "Gerenciar o computador, seus recursos, programas e dispositivos." });
    expect(g[3]).toEqual({ questionNumber: 4, correct: "Ctrl + C" });
    expect(g[4]).toEqual({ questionNumber: 5, correct: "v" });
  });

  it("ignora cabeçalhos e títulos de documentos para não criar questão falsa #1", () => {
    const raw = `
    PROVA DE INFORMÁTICA
    Nível intermediário • 25 questões
    Leia atentamente cada questão e marque a alternativa correta.
    PARTE 1 — MÚLTIPLA ESCOLHA

    1. Qual componente é responsável por executar instruções?
    a) RAM
    b) Processador (CPU)*
    c) HD
    `;
    const qs = parseQuestionsFromText(raw);
    expect(qs.length).toBe(1);
    expect(qs[0].prompt).toContain("Qual componente é responsável por executar instruções?");
    expect(qs[0].correct).toBe("b");
  });
});
