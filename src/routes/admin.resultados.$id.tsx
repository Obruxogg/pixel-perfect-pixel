import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { getSubmission, gradeManual } from "@/lib/admin.functions";
import { PageHeader, StatusPill, fmtTime, fmtDate } from "@/components/AdminShell";
import { TYPE_LABEL, QTYPE_LABEL, toTen } from "@/lib/grading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, XCircle, AlertCircle, ArrowLeft, Save, User, Calendar, Award } from "lucide-react";

export const Route = createFileRoute("/admin/resultados/$id")({
  head: () => ({
    meta: [
      { title: "Correção e Respostas — giz." },
      { name: "description", content: "Visualização individual de respostas e correção manual." },
      { property: "og:title", content: "Correção e Respostas — giz." },
      { property: "og:description", content: "Visualização individual de respostas e correção manual." },
    ],
  }),
  component: SubmissionDetail,
});

function SubmissionDetail() {
  const { id } = Route.useParams();
  const getFn = useServerFn(getSubmission);
  const gradeFn = useServerFn(gradeManual);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["submission", id],
    queryFn: () => getFn({ data: { id } }),
  });

  const [manualScores, setManualScores] = useState<Record<string, number>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  if (isLoading) return <p className="text-muted-foreground p-8">Carregando envio…</p>;
  if (!data?.submission) return <p className="text-muted-foreground p-8">Envio não encontrado.</p>;

  const { submission, assessment, items } = data;
  const participant = submission.participants as { name: string; class_name: string; entry_date: string } | null;
  const nota10 = toTen(submission.score, submission.max_score);
  const isApproved = nota10 != null && assessment ? nota10 >= Number(assessment.passing_score ?? 6) : null;

  async function handleGradeQuestion(answerId: string, maxPoints: number) {
    const rawScore = manualScores[answerId];
    if (rawScore == null || isNaN(rawScore)) return toast.error("Informe a pontuação.");
    if (rawScore < 0 || rawScore > maxPoints) return toast.error(`A pontuação deve estar entre 0 e ${maxPoints}.`);

    setSavingId(answerId);
    try {
      await gradeFn({ data: { answerId, score: rawScore } });
      qc.invalidateQueries({ queryKey: ["submission", id] });
      qc.invalidateQueries({ queryKey: ["results"] });
      toast.success("Nota da questão salva com sucesso!");
    } catch {
      toast.error("Erro ao salvar nota.");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="max-w-4xl pb-16">
      <div className="mb-4">
        <Button asChild variant="ghost" size="sm">
          <Link to="/admin/resultados">
            <ArrowLeft className="mr-1.5 size-4" /> Voltar aos Resultados
          </Link>
        </Button>
      </div>

      <PageHeader
        title={`Envio de ${participant?.name ?? "Aluno"}`}
        subtitle={`${assessment?.title ?? "Avaliação"} · ${participant?.class_name ?? "Turma"}`}
        actions={
          <div className="flex items-center gap-3">
            <StatusPill status={submission.status} />
            {nota10 != null && (
              <span
                className={`px-3 py-1 rounded-full font-bold font-mono text-sm ${
                  isApproved ? "bg-success/15 text-success border border-success/30" : "bg-destructive/15 text-destructive border border-destructive/30"
                }`}
              >
                Nota: {nota10} / 10
              </span>
            )}
          </div>
        }
      />

      {/* Overview Cards */}
      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        <div className="paper-card p-4 flex items-center gap-3">
          <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
            <User className="size-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Aluno / Turma</p>
            <p className="font-bold">{participant?.name ?? "—"}</p>
            <p className="text-xs text-muted-foreground">{participant?.class_name ?? "—"}</p>
          </div>
        </div>

        <div className="paper-card p-4 flex items-center gap-3">
          <div className="size-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-600 font-bold">
            <Calendar className="size-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Data & Horário</p>
            <p className="font-bold text-sm">{fmtDate(submission.submitted_at || submission.started_at)}</p>
            <p className="text-xs text-muted-foreground">
              Início: {fmtTime(submission.started_at)} · Fim: {fmtTime(submission.submitted_at)}
            </p>
          </div>
        </div>

        <div className="paper-card p-4 flex items-center gap-3">
          <div className="size-10 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-600 font-bold">
            <Award className="size-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Pontuação Total</p>
            <p className="font-bold text-lg">
              {submission.score ?? 0} <span className="text-xs font-normal text-muted-foreground">/ {submission.max_score ?? 0} pts</span>
            </p>
            <p className="text-xs text-muted-foreground">
              {submission.needs_review ? "Aguardando correção manual" : isApproved ? "Aprovado ✓" : "Abaixo da média"}
            </p>
          </div>
        </div>
      </div>

      {submission.needs_review && (
        <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 flex items-center gap-3">
          <AlertCircle className="size-5 text-amber-600 shrink-0" />
          <div className="text-sm">
            <p className="font-bold">Correção manual pendente</p>
            <p className="text-xs text-amber-800">
              Esta avaliação possui questões dissertativas ou abertas. Atribua a nota de cada questão abaixo e clique em salvar.
            </p>
          </div>
        </div>
      )}

      {/* Question by Question Inspection */}
      <div className="space-y-6">
        {items.map((item, idx) => {
          const { question, correct, answer } = item;
          const userAns = answer?.answer;
          const isObjective = ["unica", "multipla", "vf"].includes(question.type);
          const isScale = question.type === "escala";
          const isOpen = ["curta", "longa"].includes(question.type);

          return (
            <div key={question.id} className="paper-card p-6 relative">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-sm bg-muted size-7 rounded-full flex items-center justify-center">
                    {idx + 1}
                  </span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-muted text-muted-foreground">
                    {QTYPE_LABEL[question.type as keyof typeof QTYPE_LABEL] ?? question.type}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {!isScale && (
                    <span className="text-xs font-semibold text-muted-foreground">
                      Vale: {question.points} pts
                    </span>
                  )}
                  {answer?.score_awarded != null && (
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-primary/10 text-primary">
                      Obteve: {answer.score_awarded} pts
                    </span>
                  )}
                </div>
              </div>

              {/* Prompt */}
              <p className="font-semibold text-base mb-4 whitespace-pre-wrap">{question.prompt}</p>

              {/* Student's answer display */}
              <div className="space-y-2 mb-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Resposta do Aluno:</p>

                {isObjective && (
                  <div className="space-y-1.5">
                    {question.options.map((opt) => {
                      const isSelected =
                        Array.isArray(userAns) ? userAns.includes(opt.id) : String(userAns) === opt.id;
                      const isOptionCorrect =
                        Array.isArray(correct) ? correct.includes(opt.id) : String(correct) === opt.id;

                      let style = "border-border bg-background";
                      if (isSelected && isOptionCorrect) style = "border-success bg-success/10 text-success font-medium";
                      else if (isSelected && !isOptionCorrect) style = "border-destructive bg-destructive/10 text-destructive font-medium";
                      else if (!isSelected && isOptionCorrect) style = "border-dashed border-success/70 bg-success/5";

                      return (
                        <div key={opt.id} className={`flex items-center justify-between p-3 rounded-lg border text-sm ${style}`}>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold uppercase">{opt.id})</span>
                            <span>{opt.text}</span>
                          </div>
                          <div>
                            {isSelected && isOptionCorrect && <CheckCircle2 className="size-4 text-success" />}
                            {isSelected && !isOptionCorrect && <XCircle className="size-4 text-destructive" />}
                            {!isSelected && isOptionCorrect && (
                              <span className="text-xs text-success font-semibold">(Gabarito)</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {isOpen && (
                  <div className="p-4 rounded-lg bg-muted/30 border text-sm whitespace-pre-wrap">
                    {userAns ? String(userAns) : <span className="text-muted-foreground italic">Em branco</span>}
                  </div>
                )}

                {isScale && (
                  <div className="flex gap-2 items-center">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <span
                        key={n}
                        className={`size-10 rounded-lg border font-mono font-bold flex items-center justify-center text-sm ${
                          String(userAns) === String(n) ? "border-accent bg-accent text-accent-foreground ring-2 ring-accent" : "border-border bg-background"
                        }`}
                      >
                        {n}
                      </span>
                    ))}
                    <span className="text-xs text-muted-foreground ml-2">Resposta selecionada: {userAns ?? "—"}</span>
                  </div>
                )}
              </div>

              {/* Manual grading control for open questions */}
              {isOpen && answer && (
                <div className="pt-3 border-t flex flex-wrap items-center justify-between gap-3 bg-muted/20 p-3 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs font-semibold">Atribuir Nota (0 a {question.points}):</Label>
                    <Input
                      type="number"
                      min="0"
                      max={question.points}
                      step="0.5"
                      placeholder="0.0"
                      className="w-24 h-8 font-semibold text-center"
                      value={manualScores[answer.id] ?? answer.score_awarded ?? ""}
                      onChange={(e) => setManualScores({ ...manualScores, [answer.id]: Number(e.target.value) })}
                    />
                  </div>
                  <Button
                    size="sm"
                    variant="chalk"
                    onClick={() => handleGradeQuestion(answer.id, question.points)}
                    disabled={savingId === answer.id}
                  >
                    <Save className="size-3.5 mr-1" />
                    {savingId === answer.id ? "Salvando…" : "Salvar Nota"}
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
