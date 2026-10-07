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
        if (currentQ.detectedCorrect) {
          correct = currentQ.detectedCorrect;
        }
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

    const gabMatch = line.match(/^(gabarito|resposta|correta|resposta\s+correta)[:\s]+(.+)$/i);
    if (gabMatch) {
      const val = gabMatch[2].trim();
      if (/^[a-eA-E]$/.test(val)) {
        currentQ.detectedCorrect = val.toLowerCase();
      } else {
        currentQ.detectedCorrect = val;
      }
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

/**
 * Extracts paragraphs of text from a Word (.docx) document.
 * A .docx file is a ZIP archive containing XML files inside (e.g. `word/document.xml`).
 * This function parses the ZIP structures and decompresses `word/document.xml` using Web Stream decompression.
 */
export async function extractTextFromDocx(arrayBuffer: ArrayBuffer): Promise<string> {
  try {
    const bytes = new Uint8Array(arrayBuffer);
    const xml = await findAndDecompressFileInZip(bytes, "word/document.xml");
    if (!xml) {
      // If word/document.xml was not found directly, try fallback for any .xml containing w:p
      const textDecoder = new TextDecoder("utf-8");
      const rawText = textDecoder.decode(bytes);
      if (rawText.includes("<w:p") || rawText.includes("<w:t")) {
        return parseWordXmlParagraphs(rawText);
      }
      return "";
    }

    return parseWordXmlParagraphs(xml);
  } catch (err) {
    console.error("Error extracting text from docx:", err);
    return "";
  }
}

/**
 * Parse Word XML `<w:p>` paragraphs and `<w:t>` text nodes into clean text lines.
 */
function parseWordXmlParagraphs(xml: string): string {
  const paragraphs: string[] = [];

  // Match each <w:p>...</w:p> or <w:p ...>...</w:p>
  const pRegex = /<w:p(?:\s[^>]*)?>([\s\S]*?)<\/w:p>/g;
  let pMatch: RegExpExecArray | null;

  while ((pMatch = pRegex.exec(xml)) !== null) {
    const pContent = pMatch[1];
    // Extract all <w:t> tags within this paragraph
    const tRegex = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g;
    let tMatch: RegExpExecArray | null;
    let paragraphText = "";

    while ((tMatch = tRegex.exec(pContent)) !== null) {
      paragraphText += tMatch[1];
    }

    // Decode standard XML entities
    paragraphText = paragraphText
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .trim();

    if (paragraphText) {
      paragraphs.push(paragraphText);
    }
  }

  // If no <w:p> found, extract any <w:t> tags
  if (paragraphs.length === 0) {
    const tRegex = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g;
    let tMatch: RegExpExecArray | null;
    while ((tMatch = tRegex.exec(xml)) !== null) {
      const text = tMatch[1]
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .trim();
      if (text) paragraphs.push(text);
    }
  }

  return paragraphs.join("\n");
}

/**
 * Parses ZIP format (Local headers & Central Directory) to find a target file and decompress it.
 */
async function findAndDecompressFileInZip(bytes: Uint8Array, targetFileName: string): Promise<string | null> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  // 1. Iterate through Local File Headers (signature 0x04034b50 -> 'PK\x03\x04')
  let offset = 0;
  const len = bytes.length;

  while (offset + 30 <= len) {
    const sig = view.getUint32(offset, true);
    if (sig === 0x04034b50) {
      // Local file header
      const compression = view.getUint16(offset + 8, true);
      let compressedSize = view.getUint32(offset + 18, true);
      const uncompressedSize = view.getUint32(offset + 22, true);
      const fileNameLen = view.getUint16(offset + 26, true);
      const extraLen = view.getUint16(offset + 28, true);

      const fileNameBytes = bytes.subarray(offset + 30, offset + 30 + fileNameLen);
      const fileName = new TextDecoder("utf-8").decode(fileNameBytes);
      const dataOffset = offset + 30 + fileNameLen + extraLen;

      if (fileName.toLowerCase() === targetFileName.toLowerCase()) {
        // If compressedSize is 0 in local header (streaming flag bit 3), search Central Directory
        if (compressedSize === 0) {
          const cdSize = findCompressedSizeFromCentralDirectory(bytes, targetFileName);
          if (cdSize > 0) compressedSize = cdSize;
        }

        const sliceEnd = compressedSize > 0 ? dataOffset + compressedSize : len;
        const compressedData = bytes.subarray(dataOffset, sliceEnd);

        if (compression === 0) {
          // Uncompressed (stored)
          return new TextDecoder("utf-8").decode(compressedData.subarray(0, uncompressedSize || compressedData.length));
        } else if (compression === 8) {
          // Deflate compressed
          return await decompressDeflateRaw(compressedData);
        }
      }

      // Jump to next file if compressedSize is known
      if (compressedSize > 0) {
        offset = dataOffset + compressedSize;
      } else {
        offset++;
      }
    } else {
      offset++;
    }
  }

  // 2. If not found via local headers, scan Central Directory entries (signature 0x02014b50 -> 'PK\x01\x02')
  offset = 0;
  while (offset + 46 <= len) {
    const sig = view.getUint32(offset, true);
    if (sig === 0x02014b50) {
      const compression = view.getUint16(offset + 10, true);
      const compressedSize = view.getUint32(offset + 20, true);
      const uncompressedSize = view.getUint32(offset + 24, true);
      const fileNameLen = view.getUint16(offset + 28, true);
      const extraLen = view.getUint16(offset + 30, true);
      const commentLen = view.getUint16(offset + 32, true);
      const localHeaderOffset = view.getUint32(offset + 42, true);

      const fileNameBytes = bytes.subarray(offset + 46, offset + 46 + fileNameLen);
      const fileName = new TextDecoder("utf-8").decode(fileNameBytes);

      if (fileName.toLowerCase() === targetFileName.toLowerCase()) {
        // Read from localHeaderOffset
        const localFileNameLen = view.getUint16(localHeaderOffset + 26, true);
        const localExtraLen = view.getUint16(localHeaderOffset + 28, true);
        const dataOffset = localHeaderOffset + 30 + localFileNameLen + localExtraLen;
        const compressedData = bytes.subarray(dataOffset, dataOffset + compressedSize);

        if (compression === 0) {
          return new TextDecoder("utf-8").decode(compressedData.subarray(0, uncompressedSize || compressedData.length));
        } else if (compression === 8) {
          return await decompressDeflateRaw(compressedData);
        }
      }

      offset += 46 + fileNameLen + extraLen + commentLen;
    } else {
      offset++;
    }
  }

  return null;
}

function findCompressedSizeFromCentralDirectory(bytes: Uint8Array, targetFileName: string): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 0;
  const len = bytes.length;

  while (offset + 46 <= len) {
    const sig = view.getUint32(offset, true);
    if (sig === 0x02014b50) {
      const compressedSize = view.getUint32(offset + 20, true);
      const fileNameLen = view.getUint16(offset + 28, true);
      const extraLen = view.getUint16(offset + 30, true);
      const commentLen = view.getUint16(offset + 32, true);

      const fileNameBytes = bytes.subarray(offset + 46, offset + 46 + fileNameLen);
      const fileName = new TextDecoder("utf-8").decode(fileNameBytes);

      if (fileName.toLowerCase() === targetFileName.toLowerCase()) {
        return compressedSize;
      }
      offset += 46 + fileNameLen + extraLen + commentLen;
    } else {
      offset++;
    }
  }
  return 0;
}

/**
 * Decompresses raw DEFLATE bytes using native DecompressionStream.
 */
async function decompressDeflateRaw(compressedData: Uint8Array): Promise<string> {
  try {
    if (typeof DecompressionStream !== "undefined") {
      const ds = new DecompressionStream("deflate-raw");
      const writer = ds.writable.getWriter();
      writer.write(compressedData);
      writer.close();
      const res = new Response(ds.readable);
      const buf = await res.arrayBuffer();
      return new TextDecoder("utf-8").decode(buf);
    }
  } catch {
    // If deflate-raw fails, try standard deflate with zlib wrapper
    try {
      if (typeof DecompressionStream !== "undefined") {
        const ds = new DecompressionStream("deflate");
        const writer = ds.writable.getWriter();
        writer.write(compressedData);
        writer.close();
        const res = new Response(ds.readable);
        const buf = await res.arrayBuffer();
        return new TextDecoder("utf-8").decode(buf);
      }
    } catch {
      // ignore
    }
  }
  return "";
}

export interface ParsedGabaritoItem {
  questionNumber: number;
  correct: string | string[];
}

export function parseGabaritoOnlyText(text: string): ParsedGabaritoItem[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const results: ParsedGabaritoItem[] = [];

  for (const line of lines) {
    const match = line.match(/^(?:q|quest[aã]o|n[ºo]?)?\s*(\d+)[\.\-\:\)\s]+(.+)$/i);
    if (match) {
      const qNum = parseInt(match[1], 10);
      const val = match[2].trim();
      if (!val) continue;

      if (/^[a-eA-E](?:\s*,\s*[a-eA-E])+$/.test(val)) {
        const arr = val.split(",").map((s) => s.trim().toLowerCase());
        results.push({ questionNumber: qNum, correct: arr });
      } else if (/^[a-eA-E]$/i.test(val)) {
        results.push({ questionNumber: qNum, correct: val.toLowerCase() });
      } else if (/^v(?:erdadeiro)?$/i.test(val)) {
        results.push({ questionNumber: qNum, correct: "v" });
      } else if (/^f(?:also)?$/i.test(val)) {
        results.push({ questionNumber: qNum, correct: "f" });
      } else {
        results.push({ questionNumber: qNum, correct: val });
      }
    }
  }

  if (results.length === 0) {
    const compactMatches = [...text.matchAll(/(\d+)[\.\-\:]?\s*([a-eA-E]|v|f)/gi)];
    if (compactMatches.length > 0) {
      for (const m of compactMatches) {
        results.push({
          questionNumber: parseInt(m[1], 10),
          correct: m[2].toLowerCase(),
        });
      }
    } else {
      lines.forEach((l, i) => {
        const clean = l.replace(/^(gabarito|resposta)[:\s]*/i, "").trim();
        if (clean) {
          if (/^[a-eA-E]$/i.test(clean)) {
            results.push({ questionNumber: i + 1, correct: clean.toLowerCase() });
          } else {
            results.push({ questionNumber: i + 1, correct: clean });
          }
        }
      });
    }
  }

  return results;
}
