import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { parseQuestionsFromText, extractTextFromDocx, type ParsedQuestion } from "@/lib/docx-parser";
import { createAssessmentFromBank, listRooms } from "@/lib/admin.functions";
import { PageHeader } from "@/components/AdminShell";
import { QTYPE_LABEL, type QType } from "@/lib/grading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  Plus,
  Search,
  UploadCloud,
  Copy,
  Trash2,
  Library,
  CheckCircle2,
  Download,
  FileCheck,
  CheckSquare,
} from "lucide-react";

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
    points: 2.5,
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
    points: 2.5,
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
    points: 2.5,
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
    points: 2.5,
    options: [],
    correct: null,
  },
];

function QuestionBank() {
  const [questions, setQuestions] = useState<ParsedQuestion[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("todos");

  // Modals
  const [modalOpen, setModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [createTestOpen, setCreateTestOpen] = useState(false);

  const createFromBankFn = useServerFn(createAssessmentFromBank);
  const roomsFn = useServerFn(listRooms);
  const { data: rooms } = useQuery({ queryKey: ["rooms"], queryFn: () => roomsFn() });
  const qc = useQueryClient();
  const nav = useNavigate();

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

  function toggleSelect(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  }

  function selectAll() {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((q) => q.id)));
    }
  }

  function exportBankJson() {
    const blob = new Blob([JSON.stringify(questions, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `banco_de_questoes_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Banco de questões exportado!");
  }

  const filtered = questions.filter((q) => {
    if (search && !q.prompt.toLowerCase().includes(search.toLowerCase())) return false;
    if (typeFilter !== "todos" && q.type !== typeFilter) return false;
    return true;
  });

  return (
    <div className="max-w-5xl pb-24">
      <PageHeader
        title="Banco de Questões"
        subtitle="Armazene, reutilize, filtre e importe questões modulares para suas avaliações."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={exportBankJson} title="Exportar Banco em JSON">
              <Download className="size-4 mr-1.5" /> Exportar JSON
            </Button>
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
              <UploadCloud className="size-4 mr-1.5" /> Importar DOCX / Texto
            </Button>
            <Button variant="chalk" size="sm" onClick={() => setModalOpen(true)}>
              <Plus className="size-4 mr-1.5" /> Nova Questão
            </Button>
          </div>
        }
      />

      {/* Filters & Multi-select Bar */}
      <div className="paper-card p-4 mb-6 space-y-3">
        <div className="flex flex-wrap gap-3">
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

        <div className="flex items-center justify-between pt-2 border-t text-xs text-muted-foreground">
          <button
            type="button"
            onClick={selectAll}
            className="flex items-center gap-1.5 font-semibold text-foreground hover:underline"
          >
            <CheckSquare className="size-3.5" />
            {selectedIds.size === filtered.length && filtered.length > 0
              ? "Desmarcar todas"
              : `Selecionar todas (${filtered.length})`}
          </button>

          <span>
            {selectedIds.size} de {questions.length} questões selecionadas
          </span>
        </div>
      </div>

      {/* Question List */}
      <div className="space-y-4">
        {filtered.map((q, idx) => {
          const isSelected = selectedIds.has(q.id);
          return (
            <div
              key={q.id}
              className={`paper-card p-5 transition border-l-4 ${
                isSelected ? "border-l-primary bg-primary/5 ring-1 ring-primary" : "border-l-muted hover:border-l-accent"
              }`}
            >
              <div className="flex items-center justify-between pb-3 mb-3 border-b">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelect(q.id)}
                    className="size-4 accent-primary cursor-pointer"
                  />
                  <span className="font-mono text-xs font-bold bg-muted size-6 rounded-full flex items-center justify-center">
                    {idx + 1}
                  </span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-muted text-muted-foreground">
                    {QTYPE_LABEL[q.type as QType] ?? q.type}
                  </span>
                  <span className="text-xs text-muted-foreground font-semibold">{q.points} pts</span>
                </div>

                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="size-8" title="Copiar texto" onClick={() => handleCopy(q)}>
                    <Copy className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-destructive hover:bg-destructive/10"
                    title="Excluir do banco"
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
          );
        })}

        {!filtered.length && (
          <div className="paper-card p-12 text-center text-muted-foreground">
            <Library className="size-10 mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-lg font-medium">Nenhuma questão encontrada.</p>
            <p className="text-sm mt-1 mb-4">Adicione novas questões ou importe diretamente de um arquivo .docx.</p>
          </div>
        )}
      </div>

      {/* Floating Action Bar for Selected Questions */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-20 bg-background/95 backdrop-blur border-t px-6 py-3 flex items-center justify-between max-w-5xl mx-auto shadow-2xl animate-in slide-in-from-bottom duration-200">
          <div className="text-sm">
            <span className="font-bold text-primary">{selectedIds.size}</span>{" "}
            {selectedIds.size === 1 ? "questão selecionada" : "questões selecionadas"}
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setSelectedIds(new Set())}>
              Limpar Seleção
            </Button>
            <Button variant="chalk" size="sm" onClick={() => setCreateTestOpen(true)}>
              <FileCheck className="size-4 mr-1.5" /> Criar Avaliação com Selecionadas
            </Button>
          </div>
        </div>
      )}

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

      {/* Create Assessment with Selected Questions Modal */}
      <CreateAssessmentFromSelectionDialog
        open={createTestOpen}
        onOpenChange={setCreateTestOpen}
        selectedQuestions={questions.filter((q) => selectedIds.has(q.id))}
        rooms={rooms ?? []}
        onSubmit={async (data) => {
          try {
            const res = await createFromBankFn({
              data: {
                title: data.title,
                type: data.type,
                roomId: data.roomId,
                questions: data.questions,
              },
            });
            qc.invalidateQueries({ queryKey: ["assessments"] });
            toast.success("Avaliação criada com sucesso!");
            nav({ to: "/admin/avaliacoes/$id", params: { id: res.id } });
          } catch {
            toast.error("Erro ao criar avaliação.");
          }
        }}
      />
    </div>
  );
}

function CreateAssessmentFromSelectionDialog({
  open,
  onOpenChange,
  selectedQuestions,
  rooms,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  selectedQuestions: ParsedQuestion[];
  rooms: { id: string; name: string; code: string }[];
  onSubmit: (data: {
    title: string;
    type: "prova" | "atividade" | "questionario" | "diagnostico";
    roomId?: string;
    questions: ParsedQuestion[];
  }) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<"prova" | "atividade" | "questionario" | "diagnostico">("prova");
  const [roomId, setRoomId] = useState<string>("none");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle(`Avaliação com ${selectedQuestions.length} questões`);
      setRoomId("none");
      setType("prova");
    }
  }, [open, selectedQuestions]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return toast.error("Informe o título.");
    setBusy(true);
    await onSubmit({
      title: title.trim(),
      type,
      roomId: roomId === "none" ? undefined : roomId,
      questions: selectedQuestions,
    });
    setBusy(false);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileCheck className="size-5 text-primary" /> Criar Avaliação com {selectedQuestions.length} Questões
          </DialogTitle>
          <DialogDescription>
            Defina o título e o tipo para gerar a nova avaliação a partir das questões selecionadas.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 my-2">
          <div className="space-y-1.5">
            <Label>Título da Avaliação</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>

          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="prova">Prova</SelectItem>
                <SelectItem value="atividade">Atividade</SelectItem>
                <SelectItem value="questionario">Questionário</SelectItem>
                <SelectItem value="diagnostico">Diagnóstico</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Vincular a uma Sala (Opcional)</Label>
            <Select value={roomId} onValueChange={setRoomId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhuma sala (Salvar no Acervo)</SelectItem>
                {rooms.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name} ({r.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="chalk" disabled={busy}>
              {busy ? "Criando…" : "Gerar e Abrir Editor"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
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
      points: 2.5,
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

    if (file.name.endsWith(".json")) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const parsed = JSON.parse(ev.target?.result as string);
          if (Array.isArray(parsed)) {
            onImport(parsed);
            onOpenChange(false);
          }
        } catch {
          toast.error("JSON inválido.");
        }
      };
      reader.readAsText(file);
      return;
    }

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
            Envie um arquivo Word (.docx), JSON de backup ou cole o texto com as questões para adicionar ao seu repositório.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 my-2">
          <div>
            <Label className="font-semibold mb-1.5 block">Arquivo .docx, .json ou .txt</Label>
            <Input type="file" accept=".docx,.json,.txt,.doc" onChange={handleFileUpload} />
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
