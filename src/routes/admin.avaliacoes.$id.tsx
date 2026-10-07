import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import {
  getAssessment,
  saveAssessment,
  duplicateAssessment,
  deleteAssessment,
  unlinkAssessmentFromRoom,
} from "@/lib/admin.functions";
import { parseQuestionsFromText, extractTextFromDocx, type ParsedQuestion } from "@/lib/docx-parser";
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
  BarChart2,
  CheckCircle,
  HelpCircle,
  UploadCloud,
  Download,
  Library,
  ChevronDown,
  ChevronUp,
  Calculator,
  BookmarkPlus,
  Unlink,
  Layers,
  Sparkles,
  Search,
} from "lucide-react";

export const Route = createFileRoute("/admin/avaliacoes/$id")({
  head: () => ({
    meta: [
      { title: "Editor de Avaliação — giz." },
      { name: "description", content: "Edite questões, pontuação modular e configurações da avaliação." },
      { property: "og:title", content: "Editor de Avaliação — giz." },
      { property: "og:description", content: "Edite questões, pontuação modular e configurações da avaliação." },
    ],
  }),
  component: AssessmentEditor,
});

const BANK_STORAGE_KEY = "giz:question_bank";

interface QuestionItem {
  id: string;
  type: QType;
  prompt: string;
  points: number;
  options: { id: string; text: string }[];
  correct: string | string[] | null;
  collapsed?: boolean;
}

function AssessmentEditor() {
  const { id } = Route.useParams();
  const getFn = useServerFn(getAssessment);
  const saveFn = useServerFn(saveAssessment);
  const dupFn = useServerFn(duplicateAssessment);
  const delFn = useServerFn(deleteAssessment);
  const unlinkFn = useServerFn(unlinkAssessmentFromRoom);
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
  const [targetTotalPoints, setTargetTotalPoints] = useState<number>(10);

  // Modals
  const [importOpen, setImportOpen] = useState(false);
  const [bankPickerOpen, setBankPickerOpen] = useState(false);

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
      setQuestions(
        ((data.questions as QuestionItem[]) ?? []).map((q) => ({
          ...q,
          collapsed: false,
        })),
      );
    }
  }, [data]);

  const totalPoints = useMemo(() => {
    return questions.reduce((acc, q) => acc + (q.type === "escala" ? 0 : Number(q.points || 0)), 0);
  }, [questions]);

  // Distribute points equally across all scorable questions
  function distributePointsEqually(totalTarget: number) {
    const scorable = questions.filter((q) => q.type !== "escala");
    if (!scorable.length) return toast.warning("Nenhuma questão avaliativa encontrada.");
    const ptsPerQ = Math.round((totalTarget / scorable.length) * 100) / 100;
    const updated = questions.map((q) => ({
      ...q,
      points: q.type === "escala" ? 0 : ptsPerQ,
    }));
    setQuestions(updated);
    toast.success(`Pontos distribuídos: ${ptsPerQ} pts por questão (Total: ${totalTarget} pts).`);
  }

  function toggleCollapseAll(collapse: boolean) {
    setQuestions(questions.map((q) => ({ ...q, collapsed: collapse })));
  }

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
      collapsed: false,
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

  function saveQuestionToBank(q: QuestionItem) {
    if (!q.prompt.trim()) return toast.error("Preencha o enunciado antes de salvar no banco.");
    try {
      const raw = localStorage.getItem(BANK_STORAGE_KEY);
      const bank: ParsedQuestion[] = raw ? JSON.parse(raw) : [];
      const newBankItem: ParsedQuestion = {
        id: crypto.randomUUID(),
        type: q.type,
        prompt: q.prompt.trim(),
        points: q.points,
        options: q.options,
        correct: q.correct,
      };
      localStorage.setItem(BANK_STORAGE_KEY, JSON.stringify([newBankItem, ...bank]));
      toast.success("Questão guardada no Banco de Questões!");
    } catch {
      toast.error("Erro ao salvar no banco.");
    }
  }

  function exportToJson() {
    const payload = {
      title,
      description,
      type,
      passing_score: passingScore,
      time_limit: timeLimit,
      attempt_limit: attemptLimit,
      questions: questions.map((q) => ({
        type: q.type,
        prompt: q.prompt,
        points: q.points,
        options: q.options,
        correct: q.correct,
      })),
      exported_at: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/[^a-zA-Z0-9]/g, "_") || "avaliacao"}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Arquivo JSON exportado!");
  }

  function importFromJson(jsonString: string) {
    try {
      const parsed = JSON.parse(jsonString);
      if (parsed.title) setTitle(parsed.title);
      if (parsed.description) setDescription(parsed.description);
      if (parsed.type) setType(parsed.type);
      if (parsed.passing_score != null) setPassingScore(Number(parsed.passing_score));
      if (parsed.time_limit != null) setTimeLimit(parsed.time_limit);
      if (parsed.attempt_limit != null) setAttemptLimit(parsed.attempt_limit);
      if (Array.isArray(parsed.questions)) {
        const importedQuestions: QuestionItem[] = parsed.questions.map((q: any) => ({
          id: crypto.randomUUID(),
          type: q.type || "unica",
          prompt: q.prompt || "",
          points: Number(q.points ?? 2),
          options: Array.isArray(q.options) ? q.options : [],
          correct: q.correct ?? null,
          collapsed: false,
        }));
        setQuestions([...questions, ...importedQuestions]);
      }
      toast.success("Avaliação importada do JSON com sucesso!");
    } catch {
      toast.error("Arquivo JSON inválido.");
    }
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

  async function handleUnlinkRoom() {
    if (!roomId) return;
    try {
      await unlinkFn({ data: { id } });
      setRoomId(null);
      qc.invalidateQueries({ queryKey: ["assessment", id] });
      qc.invalidateQueries({ queryKey: ["assessments"] });
      toast.success("Avaliação desvinculada da sala.");
    } catch {
      toast.error("Erro ao desvincular sala.");
    }
  }

  async function handleDelete() {
    if (!confirm("Deseja realmente excluir esta avaliação e todos os registros vinculados a ela?")) return;
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
    <div className="max-w-5xl pb-24">
      <PageHeader
        title="Editor de Avaliação"
        subtitle="Estruture questões modulares, configure gabaritos e pontuações."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setBankPickerOpen(true)}>
              <Library className="size-4 mr-1.5 text-primary" /> Puxar do Banco
            </Button>
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
              <UploadCloud className="size-4 mr-1.5" /> Importar DOCX / Texto
            </Button>
            <Button variant="outline" size="sm" onClick={exportToJson} title="Exportar JSON">
              <Download className="size-4 mr-1.5" /> Exportar JSON
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/admin/analise/$id" params={{ id }}>
                <BarChart2 className="size-4 mr-1.5" /> Análise
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
            <div className="flex justify-between items-center">
              <Label>Vincular a uma Sala</Label>
              {roomId && (
                <button
                  type="button"
                  onClick={handleUnlinkRoom}
                  className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1 underline"
                >
                  <Unlink className="size-3" /> Desvincular
                </button>
              )}
            </div>
            <Select value={roomId ?? "none"} onValueChange={(v) => setRoomId(v === "none" ? null : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a sala" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem sala vinculada (Template)</SelectItem>
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

      {/* Modular Points & Question Control Bar */}
      <div className="paper-card p-4 mb-6 bg-muted/30 flex flex-wrap items-center justify-between gap-4 border border-border">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <span className="text-xs uppercase font-semibold text-muted-foreground block">Questões</span>
            <span className="font-bold text-lg">{questions.length}</span>
          </div>

          <div className="border-l pl-4">
            <span className="text-xs uppercase font-semibold text-muted-foreground block">Pontuação Total Atual</span>
            <span className={`font-bold text-lg ${totalPoints > 0 ? "text-primary" : "text-muted-foreground"}`}>
              {totalPoints} pts
            </span>
          </div>

          {type !== "questionario" && (
            <div className="border-l pl-4 flex items-center gap-2">
              <div>
                <Label className="text-xs text-muted-foreground whitespace-nowrap block">Meta de Pontos:</Label>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Input
                    type="number"
                    min="1"
                    max="100"
                    className="w-18 h-8 text-center font-bold text-sm"
                    value={targetTotalPoints}
                    onChange={(e) => setTargetTotalPoints(Number(e.target.value))}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs font-semibold"
                    onClick={() => distributePointsEqually(targetTotalPoints)}
                    title="Divide a pontuação igualmente entre todas as questões"
                  >
                    <Calculator className="size-3.5 mr-1" /> Distribuir Igualmente
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            onClick={() => toggleCollapseAll(true)}
            title="Recolhe todas as questões"
          >
            <ChevronUp className="size-3.5 mr-1" /> Colapsar Tudo
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            onClick={() => toggleCollapseAll(false)}
            title="Expande todas as questões"
          >
            <ChevronDown className="size-3.5 mr-1" /> Expandir Tudo
          </Button>
        </div>
      </div>

      {/* Add Questions Action Bar */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Layers className="size-5 text-primary" /> Questões
        </h2>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => addQuestion("unica")}>
            <Plus className="size-4 mr-1" /> Múltipla Escolha
          </Button>
          <Button variant="outline" size="sm" onClick={() => addQuestion("multipla")}>
            <Plus className="size-4 mr-1" /> Caixas de Seleção
          </Button>
          <Button variant="outline" size="sm" onClick={() => addQuestion("vf")}>
            <Plus className="size-4 mr-1" /> V/F
          </Button>
          <Button variant="outline" size="sm" onClick={() => addQuestion("curta")}>
            <Plus className="size-4 mr-1" /> Aberta Curta
          </Button>
          <Button variant="outline" size="sm" onClick={() => addQuestion("longa")}>
            <Plus className="size-4 mr-1" /> Dissertativa
          </Button>
          {type === "questionario" && (
            <Button variant="outline" size="sm" onClick={() => addQuestion("escala")}>
              <Plus className="size-4 mr-1" /> Escala 1–5
            </Button>
          )}
        </div>
      </div>

      {/* Questions List */}
      <div className="space-y-4">
        {questions.map((q, idx) => (
          <div
            key={q.id}
            className={`paper-card border-l-4 transition ${
              q.collapsed ? "p-4 border-l-muted-foreground/40 bg-muted/10" : "p-6 border-l-primary"
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="font-mono font-bold text-sm bg-muted size-7 rounded-full flex items-center justify-center">
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
                  <SelectTrigger className="w-44 h-8 text-xs">
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

                {q.collapsed && (
                  <p className="text-xs font-semibold text-foreground truncate max-w-xs md:max-w-md">
                    {q.prompt || "Questão sem enunciado"}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                {q.type !== "escala" && type !== "questionario" && (
                  <div className="flex items-center gap-1.5 mr-1">
                    <Label className="text-xs text-muted-foreground whitespace-nowrap">Pontos:</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      className="w-16 h-8 text-center text-xs font-bold"
                      value={q.points}
                      onChange={(e) => updateQuestion(idx, { points: Number(e.target.value) })}
                    />
                  </div>
                )}

                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground hover:text-primary"
                  onClick={() => saveQuestionToBank(q)}
                  title="Guardar esta questão no Banco de Questões"
                >
                  <BookmarkPlus className="size-4" />
                </Button>

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
                  className="size-8"
                  onClick={() => updateQuestion(idx, { collapsed: !q.collapsed })}
                  title={q.collapsed ? "Expandir" : "Recolher"}
                >
                  {q.collapsed ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
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

            {/* Expandable Body */}
            {!q.collapsed && (
              <div className="mt-4 pt-4 border-t space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Enunciado da Questão</Label>
                  <Textarea
                    value={q.prompt}
                    onChange={(e) => updateQuestion(idx, { prompt: e.target.value })}
                    placeholder="Digite o enunciado da questão…"
                    rows={3}
                    className="text-base"
                  />
                </div>

                {/* Question Options */}
                {(q.type === "unica" || q.type === "multipla" || q.type === "vf") && (
                  <div className="space-y-3 pt-2 border-t">
                    <div className="flex justify-between items-center">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Alternativas & Gabarito
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
                  <div className="space-y-3 pt-2 border-t">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <CheckCircle className="size-3.5 text-emerald-500" />
                        Resposta Esperada (Gabarito Textual)
                        <span className="font-normal normal-case text-muted-foreground/70 ml-1">— opcional para autocorreção</span>
                      </Label>
                      <Input
                        value={typeof q.correct === "string" ? q.correct : ""}
                        onChange={(e) => updateQuestion(idx, { correct: e.target.value || null })}
                        placeholder="Ex: Fotossíntese — deixe em branco para correção manual"
                        className="h-9 text-sm"
                      />
                      {typeof q.correct === "string" && q.correct.trim() && (
                        <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 space-y-0.5">
                          <p className="font-semibold">✓ Autocorreção ativa por similaridade de texto</p>
                          <p>≥ 75% similar → <b>nota cheia</b> automaticamente</p>
                          <p>50%–74% similar → <b>metade dos pontos</b> (aprovado automaticamente)</p>
                          <p>30%–49% similar → <b>metade dos pontos</b> + revisão manual</p>
                          <p>&lt; 30% similar → <b>0 pontos</b> + revisão manual</p>
                        </div>
                      )}
                      {(!q.correct || (typeof q.correct === "string" && !q.correct.trim())) && (
                        <p className="text-xs text-muted-foreground">
                          Sem gabarito textual definido — o professor precisará corrigir manualmente.
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {q.type === "longa" && (
                  <div className="p-3 bg-muted/40 rounded-lg text-xs text-muted-foreground">
                    <b>Resposta dissertativa:</b> Campo de texto livre para respostas longas corrigidas pelo professor.
                  </div>
                )}

                {q.type === "escala" && (
                  <div className="p-3 bg-muted/40 rounded-lg">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Escala de 1 a 5 para pesquisas de opinião:</p>
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
            )}
          </div>
        ))}

        {!questions.length && (
          <div className="paper-card p-12 text-center text-muted-foreground">
            <HelpCircle className="size-10 mx-auto mb-3 text-muted-foreground/50" />
            <p className="text-lg font-medium">Nenhuma questão adicionada ainda.</p>
            <p className="text-sm mt-1 mb-5">
              Monte sua avaliação adicionando questões manualmente, puxando do banco ou importando de um arquivo Word / JSON.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button variant="chalk" onClick={() => addQuestion("unica")}>
                <Plus className="size-4 mr-1" /> Criar Questão
              </Button>
              <Button variant="outline" onClick={() => setBankPickerOpen(true)}>
                <Library className="size-4 mr-1 text-primary" /> Puxar do Banco
              </Button>
              <Button variant="outline" onClick={() => setImportOpen(true)}>
                <UploadCloud className="size-4 mr-1" /> Importar DOCX / Texto
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

      {/* DOCX / Text Import Modal */}
      <ImportQuestionsDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImport={(imported) => {
          setQuestions([...questions, ...imported.map((q) => ({ ...q, collapsed: false }))]);
          toast.success(`${imported.length} questões importadas!`);
        }}
        onImportJson={importFromJson}
      />

      {/* Bank Question Picker Modal */}
      <BankQuestionPickerDialog
        open={bankPickerOpen}
        onOpenChange={setBankPickerOpen}
        onSelect={(selected) => {
          setQuestions([...questions, ...selected.map((q) => ({ ...q, id: crypto.randomUUID(), collapsed: false }))]);
          toast.success(`${selected.length} questões inseridas a partir do Banco!`);
        }}
      />
    </div>
  );
}

function BankQuestionPickerDialog({
  open,
  onOpenChange,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  onSelect: (qs: ParsedQuestion[]) => void;
}) {
  const [bank, setBank] = useState<ParsedQuestion[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [qSearch, setQSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("todos");

  useEffect(() => {
    if (open) {
      const raw = localStorage.getItem(BANK_STORAGE_KEY);
      if (raw) {
        try {
          setBank(JSON.parse(raw));
        } catch {
          setBank([]);
        }
      }
      setSelectedIds(new Set());
    }
  }, [open]);

  const filtered = bank.filter((item) => {
    if (qSearch && !item.prompt.toLowerCase().includes(qSearch.toLowerCase())) return false;
    if (typeFilter !== "todos" && item.type !== typeFilter) return false;
    return true;
  });

  function toggleSelect(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  }

  function handleConfirm() {
    const chosen = bank.filter((b) => selectedIds.has(b.id));
    onSelect(chosen);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <Library className="size-5 text-primary" /> Puxar Questões do Banco
          </DialogTitle>
          <DialogDescription>
            Selecione uma ou mais questões do seu acervo para inserir diretamente nesta avaliação.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 my-2">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="size-4 absolute left-3 top-3 text-muted-foreground" />
              <Input
                placeholder="Buscar questões no banco…"
                value={qSearch}
                onChange={(e) => setQSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os tipos</SelectItem>
                {Object.entries(QTYPE_LABEL).map(([k, l]) => (
                  <SelectItem key={k} value={k}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {filtered.map((item) => {
              const isSelected = selectedIds.has(item.id);
              return (
                <div
                  key={item.id}
                  onClick={() => toggleSelect(item.id)}
                  className={`p-3.5 rounded-xl border cursor-pointer transition flex items-start gap-3 ${
                    isSelected ? "border-primary bg-primary/10 ring-2 ring-primary" : "border-border hover:bg-muted/30"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => {}}
                    className="mt-1 size-4 accent-primary"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-muted text-muted-foreground">
                        {QTYPE_LABEL[item.type as QType] ?? item.type}
                      </span>
                      <span className="text-xs text-muted-foreground font-semibold">{item.points} pts</span>
                    </div>
                    <p className="text-sm font-medium">{item.prompt}</p>
                    {item.options.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        {item.options.map((o) => `${o.id.toUpperCase()}) ${o.text}`).join(" | ")}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}

            {!filtered.length && (
              <p className="p-8 text-center text-muted-foreground text-sm">Nenhuma questão encontrada no banco.</p>
            )}
          </div>
        </div>

        <div className="flex justify-between items-center pt-4 border-t">
          <span className="text-xs font-semibold text-muted-foreground">
            {selectedIds.size} {selectedIds.size === 1 ? "questão selecionada" : "questões selecionadas"}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button variant="chalk" onClick={handleConfirm} disabled={!selectedIds.size}>
              Inserir na Avaliação
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ImportQuestionsDialog({
  open,
  onOpenChange,
  onImport,
  onImportJson,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  onImport: (qs: QuestionItem[]) => void;
  onImportJson: (json: string) => void;
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

    if (file.name.endsWith(".json")) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const str = ev.target?.result as string;
        onImportJson(str);
        onOpenChange(false);
      };
      reader.readAsText(file);
      return;
    }

    if (file.name.endsWith(".docx")) {
      try {
        const buffer = await file.arrayBuffer();
        const extracted = await extractTextFromDocx(buffer);
        if (!extracted) {
          toast.error("Não foi possível extrair o texto do arquivo Word.");
          return;
        }
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
          <DialogTitle className="text-xl">Importar Prova / Questões (DOCX, JSON ou Texto)</DialogTitle>
          <DialogDescription>
            Selecione um arquivo Word (.docx), JSON de backup ou cole o texto com enunciados e alternativas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 my-2">
          <div>
            <Label className="font-semibold mb-1.5 block">Enviar arquivo (.docx, .json ou .txt)</Label>
            <Input type="file" accept=".docx,.json,.txt,.doc" onChange={handleFileUpload} className="cursor-pointer" />
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
