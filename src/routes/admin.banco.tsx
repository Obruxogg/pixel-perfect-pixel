import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { parseQuestionsFromText, extractTextFromDocx, type ParsedQuestion } from "@/lib/docx-parser";
import { PageHeader } from "@/components/AdminShell";
import { QTYPE_LABEL, type QType } from "@/lib/grading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Plus, Search, UploadCloud, Copy, Trash2, Library, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/admin/banco")({
  head: () => ({
    meta: [
      { title: "Banco de Questões — giz." },
      { name: "description", content: "Repositório de questões reutilizáveis e importação de avaliações." },
      { property: "og:title", content: "Banco de Questões — giz." },
      { property: "og:description", content: "Repositório de questões reutilizáveis e importação de avaliações." },
    ],
  }),
  component: QuestionBank,
});

const BANK_STORAGE_KEY = "giz:question_bank";

const DEFAULT_BANK_QUESTIONS: ParsedQuestion[] = [
  {
    id: "q-bank-1",
    type: "unica",
    prompt: "No Microsoft Excel, qual caractere deve obrigatoriamente iniciar qualquer fórmula de cálculo?",
    points: 2,
    options: [
      { id: "a", text: "O sinal de mais (+)" },
      { id: "b", text: "O sinal de igual (=)" },
      { id: "c", text: "O caractere cifrão ($)" },
      { id: "d", text: "O arroba (@)" },
    ],
    correct: "b",
  },
  {
    id: "q-bank-2",
    type: "multipla",
    prompt: "Selecione todos os formatos de arquivos de imagem suportados na web nativamente:",
    points: 2,
    options: [
      { id: "a", text: "PNG" },
      { id: "b", text: "JPEG / JPG" },
      { id: "c", text: "WEBP" },
      { id: "d", text: "EXE" },
    ],
    correct: ["a", "b", "c"],
  },
  {
    id: "q-bank-3",
    type: "vf",
    prompt: "A memória RAM é um tipo de memória não-volátil que mantém seus dados salvos após o computador ser desligado.",
    points: 2,
    options: [
      { id: "v", text: "Verdadeiro" },
      { id: "f", text: "Falso" },
    ],
    correct: "f",
  },
  {
    id: "q-bank-4",
    type: "longa",
    prompt: "Explique o conceito de Nuvem (Cloud Computing) e cite duas vantagens para empresas ou estudantes.",
    points: 3,
    options: [],
    correct: null,
  },
];

function QuestionBank() {
  const [questions, setQuestions] = useState<ParsedQuestion[]>([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("todos");
  const [modalOpen, setModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(BANK_STORAGE_KEY);
    if (saved) {
      try {
        setQuestions(JSON.parse(saved));
      } catch {
        setQuestions(DEFAULT_BANK_QUESTIONS);
      }
    } else {
      setQuestions(DEFAULT_BANK_QUESTIONS);
      localStorage.setItem(BANK_STORAGE_KEY, JSON.stringify(DEFAULT_BANK_QUESTIONS));
    }
  }, []);

  function saveBank(updated: ParsedQuestion[]) {
    setQuestions(updated);
    localStorage.setItem(BANK_STORAGE_KEY, JSON.stringify(updated));
  }

  function handleDelete(id: string) {
    if (!confirm("Deseja remover esta questão do banco?")) return;
    saveBank(questions.filter((q) => q.id !== id));
    toast.success("Questão removida do banco.");
  }

  function handleCopy(q: ParsedQuestion) {
    const text = `${q.prompt}\n${q.options.map((o) => `${o.id.toUpperCase()}) ${o.text}`).join("\n")}`;
    navigator.clipboard.writeText(text);
    toast.success("Questão copiada para a área de transferência!");
  }

  const filtered = questions.filter((q) => {
    if (search && !q.prompt.toLowerCase().includes(search.toLowerCase())) return false;
    if (typeFilter !== "todos" && q.type !== typeFilter) return false;
    return true;
  });

  return (
    <div className="max-w-5xl pb-16">
      <PageHeader
        title="Banco de Questões"
        subtitle="Armazene, reutilize e importe questões para suas provas e atividades."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <UploadCloud className="size-4 mr-1.5" /> Importar DOCX / Texto
            </Button>
            <Button variant="chalk" onClick={() => setModalOpen(true)}>
              <Plus className="size-4 mr-1.5" /> Nova Questão
            </Button>
          </div>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-64">
          <Search className="size-4 absolute left-3 top-3 text-muted-foreground" />
          <Input
            placeholder="Buscar por palavras-chave no enunciado…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Tipo de questão" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            <SelectItem value="unica">Múltipla escolha</SelectItem>
            <SelectItem value="multipla">Caixas de seleção</SelectItem>
            <SelectItem value="vf">Verdadeiro / Falso</SelectItem>
            <SelectItem value="curta">Resposta curta</SelectItem>
            <SelectItem value="longa">Resposta longa</SelectItem>
            <SelectItem value="escala">Escala 1–5</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Question List */}
      <div className="space-y-4">
        {filtered.map((q, idx) => (
          <div key={q.id} className="paper-card p-5 hover:ring-1 hover:ring-accent transition">
            <div className="flex items-center justify-between pb-3 mb-3 border-b">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold bg-muted size-6 rounded-full flex items-center justify-center">
                  {idx + 1}
                </span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-muted text-muted-foreground">
                  {QTYPE_LABEL[q.type as QType] ?? q.type}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="size-8" title="Copiar texto" onClick={() => handleCopy(q)}>
                  <Copy className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-destructive hover:bg-destructive/10"
                  title="Excluir"
                  onClick={() => handleDelete(q.id)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>

            <p className="font-semibold text-base whitespace-pre-wrap">{q.prompt}</p>

            {q.options.length > 0 && (
              <div className="grid sm:grid-cols-2 gap-2 mt-3 text-xs text-muted-foreground">
                {q.options.map((opt) => {
                  const isCorrect =
                    Array.isArray(q.correct) ? q.correct.includes(opt.id) : String(q.correct) === opt.id;
                  return (
                    <div
                      key={opt.id}
                      className={`p-2 rounded border flex items-center gap-2 ${
                        isCorrect ? "border-success bg-success/10 text-success font-medium" : "border-border"
                      }`}
                    >
                      <span className="font-mono font-bold">{opt.id.toUpperCase()})</span>
                      <span>{opt.text}</span>
                      {isCorrect && <CheckCircle2 className="size-3.5 ml-auto text-success shrink-0" />}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}

        {!filtered.length && (
          <div className="paper-card p-12 text-center text-muted-foreground">
            <Library className="size-10 mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-lg font-medium">Nenhuma questão encontrada.</p>
            <p className="text-sm mt-1 mb-4">Adicione novas questões ou importe diretamente de um arquivo .docx.</p>
          </div>
        )}
      </div>

      {/* New Question Modal */}
      <NewBankQuestionDialog
        open={modalOpen}
        onOpenChange={setModalOpen}
        onSave={(newQ) => {
          saveBank([newQ, ...questions]);
          toast.success("Questão adicionada ao banco!");
        }}
      />

      {/* Import Modal */}
      <ImportBankDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImport={(imported) => {
          saveBank([...imported, ...questions]);
          toast.success(`${imported.length} questões importadas para o banco!`);
        }}
      />
    </div>
  );
}

function NewBankQuestionDialog({
  open,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  onSave: (q: ParsedQuestion) => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [type, setType] = useState<QType>("unica");
  const [options, setOptions] = useState([
    { id: "a", text: "" },
    { id: "b", text: "" },
    { id: "c", text: "" },
    { id: "d", text: "" },
  ]);
  const [correct, setCorrect] = useState<string | string[]>("a");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim()) return toast.error("Informe o enunciado.");

    const finalOptions = ["unica", "multipla", "vf"].includes(type)
      ? options.filter((o) => o.text.trim().length > 0)
      : [];

    onSave({
      id: crypto.randomUUID(),
      type,
      prompt: prompt.trim(),
      points: 2,
      options: finalOptions,
      correct: ["unica", "multipla", "vf"].includes(type) ? correct : null,
    });
    onOpenChange(false);
    setPrompt("");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova Questão no Banco</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Tipo de Questão</Label>
            <Select value={type} onValueChange={(v) => setType(v as QType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(QTYPE_LABEL).map(([k, label]) => (
                  <SelectItem key={k} value={k}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Enunciado</Label>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Digite o enunciado da questão…"
              rows={3}
            />
          </div>

          {(type === "unica" || type === "multipla" || type === "vf") && (
            <div className="space-y-2">
              <Label className="text-xs uppercase text-muted-foreground font-semibold">Alternativas</Label>
              {options.map((opt, idx) => (
                <div key={opt.id} className="flex items-center gap-2">
                  <input
                    type={type === "multipla" ? "checkbox" : "radio"}
                    name="bank-correct"
                    checked={
                      type === "multipla"
                        ? Array.isArray(correct) && correct.includes(opt.id)
                        : correct === opt.id
                    }
                    onChange={() => {
                      if (type === "multipla") {
                        const cur = Array.isArray(correct) ? correct : [];
                        setCorrect(cur.includes(opt.id) ? cur.filter((x) => x !== opt.id) : [...cur, opt.id]);
                      } else {
                        setCorrect(opt.id);
                      }
                    }}
                    className="accent-primary"
                  />
                  <span className="font-mono text-xs font-bold text-muted-foreground w-4">{opt.id.toUpperCase()})</span>
                  <Input
                    value={opt.text}
                    onChange={(e) => {
                      const list = [...options];
                      list[idx].text = e.target.value;
                      setOptions(list);
                    }}
                    placeholder={`Opção ${opt.id.toUpperCase()}`}
                    className="h-8 text-xs"
                  />
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="chalk">
              Salvar Questão
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ImportBankDialog({
  open,
  onOpenChange,
  onImport,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  onImport: (qs: ParsedQuestion[]) => void;
}) {
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<ParsedQuestion[]>([]);

  function processText(raw: string) {
    setText(raw);
    const parsed = parseQuestionsFromText(raw);
    setPreview(parsed);
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.name.endsWith(".docx")) {
      try {
        const buffer = await file.arrayBuffer();
        const extracted = await extractTextFromDocx(buffer);
        processText(extracted);
        toast.success("Documento processado!");
      } catch {
        toast.error("Erro ao ler DOCX.");
      }
    } else {
      const reader = new FileReader();
      reader.onload = (ev) => processText(ev.target?.result as string);
      reader.readAsText(file);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar para o Banco de Questões</DialogTitle>
          <DialogDescription>
            Envie um arquivo Word (.docx) ou cole o texto com as questões para adicionar ao seu repositório.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 my-2">
          <div>
            <Label className="font-semibold mb-1.5 block">Arquivo .docx ou .txt</Label>
            <Input type="file" accept=".docx,.txt" onChange={handleFileUpload} />
          </div>

          <div className="space-y-1.5">
            <Label className="font-semibold">Texto</Label>
            <Textarea
              value={text}
              onChange={(e) => processText(e.target.value)}
              placeholder="1. Qual é a capital do Brasil?\na) Rio de Janeiro\nb) Brasília*\nc) São Paulo"
              rows={5}
              className="font-mono text-xs"
            />
          </div>

          {preview.length > 0 && (
            <div className="p-3 bg-muted/40 rounded-lg text-xs">
              <p className="font-bold text-success mb-2">✓ {preview.length} questões detectadas:</p>
              <ul className="space-y-1 max-h-36 overflow-y-auto">
                {preview.map((p, i) => (
                  <li key={i} className="truncate">
                    {i + 1}. {p.prompt}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            variant="chalk"
            disabled={!preview.length}
            onClick={() => {
              onImport(preview);
              onOpenChange(false);
            }}
          >
            Importar {preview.length} questões
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
