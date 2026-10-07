import { describe, it, expect } from "vitest";
import { parseQuestionsFromText } from "./docx-parser";

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
});
