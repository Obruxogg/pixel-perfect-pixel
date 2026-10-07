import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { getAssessment, saveAssessment, duplicateAssessment, deleteAssessment } from "@/lib/admin.functions";
import { parseQuestionsFromText, extractTextFromDocx } from "@/lib/docx-parser";
import { PageHeader, StatusPill } from "@/components/AdminShell";
import { QTYPE_LABEL, type QType } from "@/lib/grading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  Plus,
  Trash2,
  Copy,
  ArrowUp,
  ArrowDown,
  Save,
  FileText,
  BarChart2,
  CheckCircle,
  HelpCircle,
  UploadCloud,
} from "lucide-react";

export const Route = createFileRoute("/admin/avaliacoes/$id")({
  head: () => ({
    meta: [
      { title: "Editor de Avaliação — giz." },
      { name: "description", content: "Edite questões, pontuação e configurações da avaliação." },
      { property: "og:title", content: "Editor de Avaliação — giz." },
      { property: "og:description", content: "Edite questões, pontuação e configurações da avaliação." },
    ],
  }),
  component: AssessmentEditor,
});

interface QuestionItem {
  id: string;
  type: QType;
  prompt: string;
  points: number;
  options: { id: string; text: string }[];
  correct: string | string[] | null;
}

function AssessmentEditor() {
  const { id } = Route.useParams();
  const getFn = useServerFn(getAssessment);
  const saveFn = useServerFn(saveAssessment);
  const dupFn = useServerFn(duplicateAssessment);
  const delFn = useServerFn(deleteAssessment);
  const qc = useQueryClient();
  const nav = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ["assessment", id],
    queryFn: () => getFn({ data: { id } }),
  });

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"prova" | "atividade" | "questionario" | "diagnostico">("prova");
  const [status, setStatus] = useState<"rascunho" | "disponivel" | "encerrada">("rascunho");
  const [roomId, setRoomId] = useState<string | null>(null);
  const [timeLimit, setTimeLimit] = useState<number | null>(null);
  const [passingScore, setPassingScore] = useState<number>(6);
  const [attemptLimit, setAttemptLimit] = useState<number>(1);
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  useEffect(() => {
    if (data?.assessment) {
      setTitle(data.assessment.title);
      setDescription(data.assessment.description || "");
      setType(data.assessment.type as "prova" | "atividade" | "questionario" | "diagnostico");
      setStatus(data.assessment.status as "rascunho" | "disponivel" | "encerrada");
      setRoomId(data.assessment.room_id);
      setTimeLimit(data.assessment.time_limit);
      setPassingScore(Number(data.assessment.passing_score ?? 6));
      setAttemptLimit(Number(data.assessment.attempt_limit ?? 1));
      setQuestions((data.questions as QuestionItem[]) ?? []);
    }
  }, [data]);

  const totalPoints = questions.reduce((acc, q) => acc + (q.type === "escala" ? 0 : Number(q.points || 0)), 0);

  function addQuestion(qType: QType = "unica") {
    const newId = crypto.randomUUID();
    let defaultOptions: { id: string; text: string }[] = [];
    let defaultCorrect: string | string[] | null = null;

    if (qType === "unica" || qType === "multipla") {
      defaultOptions = [
        { id: "a", text: "Opção A" },
        { id: "b", text: "Opção B" },
        { id: "c", text: "Opção C" },
        { id: "d", text: "Opção D" },
      ];
      defaultCorrect = qType === "unica" ? "a" : ["a"];
    } else if (qType === "vf") {
      defaultOptions = [
        { id: "v", text: "Verdadeiro" },
        { id: "f", text: "Falso" },
      ];
      defaultCorrect = "v";
    }

    const newQ: QuestionItem = {
      id: newId,
      type: qType,
      prompt: "",
      points: type === "questionario" || qType === "escala" ? 0 : 2,
      options: defaultOptions,
      correct: defaultCorrect,
    };

    setQuestions([...questions, newQ]);
  }

  function removeQuestion(index: number) {
    const list = [...questions];
    list.splice(index, 1);
    setQuestions(list);
  }

  function moveQuestion(index: number, direction: "up" | "down") {
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= questions.length) return;
    const list = [...questions];
    const [temp] = list.splice(index, 1);
    list.splice(target, 0, temp);
    setQuestions(list);
  }

  function updateQuestion(index: number, patch: Partial<QuestionItem>) {
    const list = [...questions];
    list[index] = { ...list[index], ...patch };
    setQuestions(list);
  }

  function addOption(qIndex: number) {
    const q = questions[qIndex];
    const nextChar = String.fromCharCode(97 + q.options.length);
    const updatedOptions = [...q.options, { id: nextChar, text: `Opção ${nextChar.toUpperCase()}` }];
    updateQuestion(qIndex, { options: updatedOptions });
  }

  function removeOption(qIndex: number, optIndex: number) {
    const q = questions[qIndex];
    if (q.options.length <= 2) return toast.warning("Mínimo de 2 opções necessárias.");
    const optId = q.options[optIndex].id;
    const updatedOptions = q.options.filter((_, idx) => idx !== optIndex);
    let newCorrect = q.correct;
    if (q.type === "unica" && q.correct === optId) {
      newCorrect = updatedOptions[0]?.id ?? null;
    } else if (q.type === "multipla" && Array.isArray(q.correct)) {
      newCorrect = q.correct.filter((x) => x !== optId);
    }
    updateQuestion(qIndex, { options: updatedOptions, correct: newCorrect });
  }

  async function handleSave() {
    if (!title.trim()) return toast.error("Informe o título da avaliação.");
    for (let i = 0; i < questions.length; i++) {
      if (!questions[i].prompt.trim()) {
        return toast.error(`A questão ${i + 1} precisa ter um enunciado.`);
      }
    }

    setIsSaving(true);
    try {
      await saveFn({
        data: {
          id,
          fields: {
            title: title.trim(),
            description: description.trim() || null,
            type,
            status,
            room_id: roomId || null,
            time_limit: timeLimit ? Number(timeLimit) : null,
            passing_score: Number(passingScore),
            attempt_limit: Number(attemptLimit),
          },
          questions: questions.map((q) => ({
            id: q.id,
            type: q.type,
            prompt: q.prompt.trim(),
            points: Number(q.points),
            options: q.options,
            correct: q.correct,
          })),
        },
      });
      qc.invalidateQueries({ queryKey: ["assessment", id] });
      qc.invalidateQueries({ queryKey: ["assessments"] });
      toast.success("Avaliação salva com sucesso!");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar avaliação.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDuplicate() {
    try {
      const res = await dupFn({ data: { id } });
      toast.success("Avaliação duplicada!");
      nav({ to: "/admin/avaliacoes/$id", params: { id: res.id } });
    } catch {
      toast.error("Erro ao duplicar avaliação.");
    }
  }

  async function handleDelete() {
    if (!confirm("Deseja realmente excluir esta avaliação?")) return;
    try {
      await delFn({ data: { id } });
      qc.invalidateQueries({ queryKey: ["assessments"] });
      toast.success("Avaliação excluída.");
      nav({ to: "/admin/avaliacoes" });
    } catch {
      toast.error("Erro ao excluir avaliação.");
    }
  }

  if (isLoading) return <p className="text-muted-foreground p-8">Carregando editor…</p>;
  if (!data?.assessment) return <p className="text-muted-foreground p-8">Avaliação não encontrada.</p>;

  return (
    <div className="max-w-5xl pb-20">
      <PageHeader
        title="Editor de Avaliação"
        subtitle="Configure detalhes, pontuações e elabore as questões."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
              <UploadCloud className="size-4 mr-1.5" /> Importar DOCX / Texto
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/admin/analise/$id" params={{ id }}>
                <BarChart2 className="size-4 mr-1.5" /> Ver Resultados
              </Link>
            </Button>
            <Button variant="ghost" size="sm" onClick={handleDuplicate} title="Duplicar">
              <Copy className="size-4 mr-1.5" /> Duplicar
            </Button>
            <Button variant="ghost" size="sm" onClick={handleDelete} className="text-destructive hover:bg-destructive/10">
              <Trash2 className="size-4 mr-1.5" /> Excluir
            </Button>
            <Button variant="chalk" size="sm" onClick={handleSave} disabled={isSaving}>
              <Save className="size-4 mr-1.5" /> {isSaving ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        }
      />

      {/* Main Settings Card */}
      <div className="paper-card p-6 mb-8 space-y-6">
        <div className="grid gap-4 sm:grid-cols-12">
          <div className="sm:col-span-8 space-y-1.5">
            <Label className="font-semibold">Título da Avaliação</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Prova de Excel Bimestral"
              className="font-bold text-lg h-11"
            />
          </div>

          <div className="sm:col-span-4 space-y-1.5">
            <Label className="font-semibold">Status de Publicação</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as "rascunho" | "disponivel" | "encerrada")}>
              <SelectTrigger className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rascunho">
                  <StatusPill status="rascunho" />
                </SelectItem>
                <SelectItem value="disponivel">
                  <StatusPill status="disponivel" />
                </SelectItem>
                <SelectItem value="encerrada">
                  <StatusPill status="encerrada" />
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Tipo de Atividade</Label>
            <Select value={type} onValueChange={(v) => setType(v as "prova" | "atividade" | "questionario" | "diagnostico")}>
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
            <Label>Vincular a uma Sala</Label>
            <Select value={roomId ?? "none"} onValueChange={(v) => setRoomId(v === "none" ? null : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a sala" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem sala vinculada</SelectItem>
                {(data.rooms ?? []).map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name} ({r.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Tentativas Permitidas</Label>
            <Select value={String(attemptLimit)} onValueChange={(v) => setAttemptLimit(Number(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 tentativa</SelectItem>
                <SelectItem value="2">2 tentativas</SelectItem>
                <SelectItem value="3">3 tentativas</SelectItem>
                <SelectItem value="0">Ilimitadas</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Média Mínima para Aprovação (0 a 10)</Label>
            <Input
              type="number"
              min="0"
              max="10"
              step="0.5"
              value={passingScore}
              onChange={(e) => setPassingScore(Number(e.target.value))}
              disabled={type === "questionario"}
            />
            {type === "questionario" && (
              <p className="text-xs text-muted-foreground">Questionários não utilizam nota mínima.</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Tempo Limite (em minutos)</Label>
            <Input
              type="number"
              min="0"
              max="600"
              placeholder="Ex: 50 (deixe vazio para sem limite)"
              value={timeLimit ?? ""}
              onChange={(e) => setTimeLimit(e.target.value ? Number(e.target.value) : null)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Descrição / Instruções para o Aluno (opcional)</Label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ex: Leia atentamente antes de responder. Não é permitido consulta externa."
            rows={2}
          />
        </div>
      </div>

      {/* Questions Section */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold">Questões da Avaliação</h2>
          <p className="text-sm text-muted-foreground">
            {questions.length} {questions.length === 1 ? "questão" : "questões"} · Pontuação total:{" "}
            <span className="font-semibold text-foreground">{totalPoints} pontos</span>
          </p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => addQuestion("unica")}>
            <Plus className="size-4 mr-1" /> Múltipla Escolha
          </Button>
          <Button variant="outline" size="sm" onClick={() => addQuestion("vf")}>
            <Plus className="size-4 mr-1" /> V/F
          </Button>
          <Button variant="outline" size="sm" onClick={() => addQuestion("curta")}>
            <Plus className="size-4 mr-1" /> Aberta
          </Button>
          {type === "questionario" && (
            <Button variant="outline" size="sm" onClick={() => addQuestion("escala")}>
              <Plus className="size-4 mr-1" /> Escala 1–5
            </Button>
          )}
        </div>
      </div>

      {/* Questions List */}
      <div className="space-y-6">
        {questions.map((q, idx) => (
          <div key={q.id} className="paper-card p-6 border-l-4 border-l-primary relative">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-4 border-b">
              <div className="flex items-center gap-3">
                <span className="font-mono font-bold text-lg bg-muted size-8 rounded-full flex items-center justify-center">
                  {idx + 1}
                </span>
                <Select
                  value={q.type}
                  onValueChange={(val) => {
                    const newType = val as QType;
                    let opts = q.options;
                    let corr = q.correct;
                    if (newType === "vf" && opts.length !== 2) {
                      opts = [
                        { id: "v", text: "Verdadeiro" },
                        { id: "f", text: "Falso" },
                      ];
                      corr = "v";
                    } else if (newType === "unica" || newType === "multipla") {
                      if (!opts.length) {
                        opts = [
                          { id: "a", text: "Opção A" },
                          { id: "b", text: "Opção B" },
                          { id: "c", text: "Opção C" },
                          { id: "d", text: "Opção D" },
                        ];
                      }
                      corr = newType === "unica" ? opts[0]?.id ?? "a" : [opts[0]?.id ?? "a"];
                    }
                    updateQuestion(idx, {
                      type: newType,
                      options: opts,
                      correct: corr,
                      points: newType === "escala" ? 0 : q.points,
                    });
                  }}
                >
                  <SelectTrigger className="w-48 h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(QTYPE_LABEL).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                {q.type !== "escala" && type !== "questionario" && (
                  <div className="flex items-center gap-1.5 mr-2">
                    <Label className="text-xs text-muted-foreground whitespace-nowrap">Pontos:</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      className="w-18 h-8 text-center text-sm font-semibold"
                      value={q.points}
                      onChange={(e) => updateQuestion(idx, { points: Number(e.target.value) })}
                    />
                  </div>
                )}

                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  disabled={idx === 0}
                  onClick={() => moveQuestion(idx, "up")}
                  title="Mover para cima"
                >
                  <ArrowUp className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  disabled={idx === questions.length - 1}
                  onClick={() => moveQuestion(idx, "down")}
                  title="Mover para baixo"
                >
                  <ArrowDown className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-destructive hover:bg-destructive/10"
                  onClick={() => removeQuestion(idx)}
                  title="Remover questão"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>

            {/* Prompt Textarea */}
            <div className="space-y-2 mb-4">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Enunciado</Label>
              <Textarea
                value={q.prompt}
                onChange={(e) => updateQuestion(idx, { prompt: e.target.value })}
                placeholder="Digite a pergunta ou instrução desta questão…"
                rows={3}
                className="text-base"
              />
            </div>

            {/* Question Options or Specific Inputs */}
            {(q.type === "unica" || q.type === "multipla" || q.type === "vf") && (
              <div className="space-y-3 mt-4 pt-3 border-t">
                <div className="flex justify-between items-center">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Alternativas (Selecione o gabarito correto)
                  </p>
                  {q.type !== "vf" && (
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => addOption(idx)}>
                      <Plus className="size-3.5 mr-1" /> Adicionar Alternativa
                    </Button>
                  )}
                </div>

                <div className="space-y-2">
                  {q.options.map((opt, oIdx) => {
                    const isSingleCorrect = q.correct === opt.id;
                    const isMultiCorrect = Array.isArray(q.correct) && q.correct.includes(opt.id);

                    return (
                      <div key={opt.id} className="flex items-center gap-3">
                        {q.type === "unica" || q.type === "vf" ? (
                          <input
                            type="radio"
                            name={`correct-${q.id}`}
                            checked={isSingleCorrect}
                            onChange={() => updateQuestion(idx, { correct: opt.id })}
                            className="size-4.5 accent-primary cursor-pointer"
                            title="Marcar como alternativa correta"
                          />
                        ) : (
                          <input
                            type="checkbox"
                            checked={isMultiCorrect}
                            onChange={() => {
                              const cur = Array.isArray(q.correct) ? q.correct : [];
                              const updated = isMultiCorrect
                                ? cur.filter((x) => x !== opt.id)
                                : [...cur, opt.id];
                              updateQuestion(idx, { correct: updated });
                            }}
                            className="size-4.5 accent-primary cursor-pointer"
                            title="Marcar como alternativa correta"
                          />
                        )}

                        <span className="font-mono text-xs font-bold text-muted-foreground w-4 text-center">
                          {opt.id.toUpperCase()}
                        </span>

                        <Input
                          value={opt.text}
                          onChange={(e) => {
                            const updatedOpts = [...q.options];
                            updatedOpts[oIdx].text = e.target.value;
                            updateQuestion(idx, { options: updatedOpts });
                          }}
                          className="flex-1 h-9 text-sm"
                        />

                        {q.type !== "vf" && q.options.length > 2 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-muted-foreground hover:text-destructive"
                            onClick={() => removeOption(idx, oIdx)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {q.type === "curta" && (
              <div className="mt-3 p-3 bg-muted/40 rounded-lg text-xs text-muted-foreground">
                <p>
                  <b>Resposta curta:</b> O aluno responderá em uma linha de texto. A correção é realizada pelo professor
                  na tela de resultados.
                </p>
              </div>
            )}

            {q.type === "longa" && (
              <div className="mt-3 p-3 bg-muted/40 rounded-lg text-xs text-muted-foreground">
                <p>
                  <b>Resposta longa:</b> Campo de texto livre dissertativo para respostas aprofundadas com correção manual do
                  professor.
                </p>
              </div>
            )}

            {q.type === "escala" && (
              <div className="mt-3 p-4 bg-muted/40 rounded-lg">
                <p className="text-xs font-medium text-muted-foreground mb-2">Escala de 1 a 5 para satisfação e opinião:</p>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <span
                      key={n}
                      className="size-8 rounded border border-border bg-background flex items-center justify-center font-mono font-bold text-xs"
                    >
                      {n}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}

        {!questions.length && (
          <div className="paper-card p-12 text-center text-muted-foreground">
            <HelpCircle className="size-10 mx-auto mb-3 text-muted-foreground/50" />
            <p className="text-lg font-medium">Nenhuma questão adicionada ainda.</p>
            <p className="text-sm mt-1 mb-5">
              Comece adicionando questões manualmente ou importe de um documento Word / DOCX.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button variant="chalk" onClick={() => addQuestion("unica")}>
                <Plus className="size-4 mr-1" /> Adicionar Questão
              </Button>
              <Button variant="outline" onClick={() => setImportOpen(true)}>
                <UploadCloud className="size-4 mr-1" /> Importar de Texto / DOCX
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Floating Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-20 bg-background/95 backdrop-blur border-t px-6 py-3 flex items-center justify-between max-w-5xl mx-auto shadow-lg">
        <div className="text-sm">
          <span className="font-semibold">{questions.length} questões</span> · Pontuação:{" "}
          <span className="font-bold">{totalPoints} pts</span>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link to="/admin/avaliacoes">Voltar</Link>
          </Button>
          <Button variant="chalk" onClick={handleSave} disabled={isSaving}>
            <Save className="size-4 mr-1.5" /> {isSaving ? "Salvando…" : "Salvar Alterações"}
          </Button>
        </div>
      </div>

      {/* Import Modal */}
      <ImportQuestionsDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImport={(imported) => {
          setQuestions([...questions, ...imported]);
          toast.success(`${imported.length} questões importadas com sucesso!`);
        }}
      />
    </div>
  );
}

function ImportQuestionsDialog({
  open,
  onOpenChange,
  onImport,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  onImport: (qs: QuestionItem[]) => void;
}) {
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<QuestionItem[]>([]);

  function processText(raw: string) {
    setText(raw);
    const parsed = parseQuestionsFromText(raw);
    setPreview(parsed as QuestionItem[]);
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.name.endsWith(".docx")) {
      try {
        const buffer = await file.arrayBuffer();
        const extracted = await extractTextFromDocx(buffer);
        processText(extracted);
        toast.success("Documento DOCX processado! Revise abaixo.");
      } catch {
        toast.error("Erro ao ler arquivo .docx.");
      }
    } else {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const str = ev.target?.result as string;
        processText(str);
      };
      reader.readAsText(file);
    }
  }

  function handleConfirm() {
    if (!preview.length) return toast.error("Nenhuma questão identificada.");
    onImport(preview);
    onOpenChange(false);
    setText("");
    setPreview([]);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">Importar Prova / Questões (DOCX ou Texto)</DialogTitle>
          <DialogDescription>
            Cole o texto da avaliação ou selecione um arquivo .docx. O sistema identifica enunciados, alternativas e
            gabaritos automaticamente para você revisar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 my-2">
          <div>
            <Label className="font-semibold mb-1.5 block">Enviar arquivo (.docx ou .txt)</Label>
            <Input type="file" accept=".docx,.txt,.doc" onChange={handleFileUpload} className="cursor-pointer" />
          </div>

          <div className="space-y-1.5">
            <Label className="font-semibold">Ou cole o texto formatado aqui:</Label>
            <Textarea
              value={text}
              onChange={(e) => processText(e.target.value)}
              placeholder={`1. Qual fórmula calcula a média no Excel?\na) =SOMA(A1:A10)\nb) =MEDIA(A1:A10)*\nc) =CALC()\nd) =TOTAL()\n\n2. (V) O Excel faz gráficos.\n(F) O Excel não permite fórmulas.`}
              rows={6}
              className="font-mono text-xs"
            />
          </div>

          {preview.length > 0 && (
            <div className="mt-4 pt-4 border-t space-y-3">
              <div className="flex justify-between items-center">
                <p className="font-bold text-sm text-success flex items-center gap-1.5">
                  <CheckCircle className="size-4" /> {preview.length} questões identificadas para importação:
                </p>
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto bg-muted/40 p-3 rounded-lg text-xs">
                {preview.map((pq, pIdx) => (
                  <div key={pq.id} className="border-b last:border-0 pb-2">
                    <p className="font-bold">
                      {pIdx + 1}. {pq.prompt} <span className="font-normal text-muted-foreground">({QTYPE_LABEL[pq.type]})</span>
                    </p>
                    {pq.options.length > 0 && (
                      <p className="text-muted-foreground mt-0.5">
                        Alternativas: {pq.options.map((o) => `${o.id.toUpperCase()}) ${o.text}`).join(" | ")}
                        {pq.correct && ` — Gabarito: ${Array.isArray(pq.correct) ? pq.correct.join(", ") : pq.correct}`}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant="chalk" onClick={handleConfirm} disabled={!preview.length}>
            Importar {preview.length} {preview.length === 1 ? "questão" : "questões"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
