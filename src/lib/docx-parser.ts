// Intelligent question extractor from raw text, Markdown, or DOCX document XML.
export interface ParsedQuestion {
  id: string;
  type: "unica" | "multipla" | "vf" | "curta" | "longa" | "escala";
  prompt: string;
  points: number;
  options: { id: string; text: string }[];
  correct: string | string[] | null;
}

export function parseQuestionsFromText(text: string): ParsedQuestion[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const questions: ParsedQuestion[] = [];
  let currentQ: {
    promptLines: string[];
    options: { id: string; text: string; isCorrect: boolean }[];
    type: "unica" | "multipla" | "vf" | "curta" | "longa" | "escala";
    points: number;
    detectedCorrect?: string;
  } | null = null;

  const isQuestionStart = (line: string) => {
    return /^(\d+[\.\-\)]|quest[aã]o\s+\d+[:\.\-\)]?|q\d+[:\.\-\)])/i.test(line);
  };

  function finalizeQuestion() {
    if (!currentQ || !currentQ.promptLines.length) return;
    const prompt = currentQ.promptLines.join("\n").replace(/^(\d+[\.\-\)]|quest[aã]o\s+\d+[:\.\-\)]?|q\d+[:\.\-\)])\s*/i, "").trim();
    if (!prompt) return;

    let finalType = currentQ.type;
    const finalOptions: { id: string; text: string }[] = [];
    let correct: string | string[] | null = null;

    if (currentQ.options.length > 0) {
      if (currentQ.type === "vf") {
        finalType = "vf";
        finalOptions.push(
          { id: "v", text: "Verdadeiro" },
          { id: "f", text: "Falso" },
        );
        correct = currentQ.options.some((o) => o.isCorrect) ? "v" : "v";
      } else {
        currentQ.options.forEach((o, idx) => {
          const id = String.fromCharCode(97 + idx); // a, b, c, d...
          finalOptions.push({ id, text: o.text });
        });

        const correctList = currentQ.options
          .map((o, idx) => (o.isCorrect ? String.fromCharCode(97 + idx) : null))
          .filter((x): x is string => x !== null);

        if (currentQ.detectedCorrect) {
          const letter = currentQ.detectedCorrect.toLowerCase();
          correct = letter;
        } else if (correctList.length > 1) {
          finalType = "multipla";
          correct = correctList;
        } else if (correctList.length === 1) {
          finalType = "unica";
          correct = correctList[0];
        } else if (finalOptions.length === 2 && finalOptions.some((o) => /verdadeiro|falso/i.test(o.text))) {
          finalType = "vf";
        } else {
          finalType = "unica";
        }
      }
    } else {
      if (/escala|avalie de 1 a 5|nota de 1 a 5/i.test(prompt)) {
        finalType = "escala";
      } else if (/explique|descreva|discorra|comente/i.test(prompt)) {
        finalType = "longa";
      } else {
        finalType = "curta";
      }
    }

    questions.push({
      id: crypto.randomUUID(),
      type: finalType,
      prompt,
      points: finalType === "escala" ? 0 : currentQ.points || 1,
      options: finalOptions,
      correct,
    });
  }

  for (const line of lines) {
    if (isQuestionStart(line)) {
      finalizeQuestion();
      currentQ = {
        promptLines: [line],
        options: [],
        type: "unica",
        points: 1,
      };
      continue;
    }

    if (!currentQ) {
      currentQ = {
        promptLines: [line],
        options: [],
        type: "unica",
        points: 1,
      };
      continue;
    }

    const gabMatch = line.match(/^(gabarito|resposta|correta|resposta\s+correta)[:\s]+([a-eA-E])/i);
    if (gabMatch) {
      currentQ.detectedCorrect = gabMatch[2].toLowerCase();
      continue;
    }

    const optMatch = line.match(/^([a-eA-E][\.\-\)]|\([a-eA-E]\)|\[([xX ])\]|\(([xX ])\))\s*(.+)$/i);
    if (optMatch) {
      const mark = optMatch[2] || optMatch[3];
      const isCorrect = /x/i.test(mark || "") || /\*\s*$/.test(line) || /^\*/.test(line);
      const cleanText = optMatch[4].replace(/\*$/, "").trim();
      currentQ.options.push({
        id: String(currentQ.options.length),
        text: cleanText,
        isCorrect,
      });
      continue;
    }

    const vfMatch = line.match(/^\(([vVfF\s])\)\s*(.+)$/i);
    if (vfMatch) {
      const isCorrect = /[vV]/.test(vfMatch[1]);
      currentQ.type = "vf";
      currentQ.options.push({
        id: String(currentQ.options.length),
        text: vfMatch[2].trim(),
        isCorrect,
      });
      continue;
    }

    // Otherwise append line to current question prompt
    if (currentQ.options.length === 0) {
      currentQ.promptLines.push(line);
    }
  }

  finalizeQuestion();
  return questions;
}

// Function to extract text from a DOCX ArrayBuffer in browser using XML parsing
export async function extractTextFromDocx(arrayBuffer: ArrayBuffer): Promise<string> {
  try {
    const uint8 = new Uint8Array(arrayBuffer);
    const decoder = new TextDecoder("utf-8");
    const binaryString = decoder.decode(uint8);

    const wtMatches = binaryString.match(/<w:t[^>]*>(.*?)<\/w:t>/g);
    if (wtMatches && wtMatches.length > 0) {
      const texts: string[] = [];
      for (const m of wtMatches) {
        const text = m.replace(/<[^>]+>/g, "");
        texts.push(text);
      }
      return texts.join("\n");
    }

    return binaryString.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  } catch {
    return "";
  }
}
