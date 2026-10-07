import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { getAnalysis } from "@/lib/admin.functions";
import { PageHeader, StatusPill } from "@/components/AdminShell";
import { TYPE_LABEL, QTYPE_LABEL } from "@/lib/grading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, BarChart3, Users, Award, TrendingUp, Search, MessageSquare, CheckCircle, Edit3 } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

export const Route = createFileRoute("/admin/analise/$id")({
  head: () => ({
    meta: [
      { title: "Análise de Resultados — giz." },
      { name: "description", content: "Métricas detalhadas e análise por questão." },
      { property: "og:title", content: "Análise de Resultados — giz." },
      { property: "og:description", content: "Métricas detalhadas e análise por questão." },
    ],
  }),
  component: AssessmentAnalysis,
});

function AssessmentAnalysis() {
  const { id } = Route.useParams();
  const getFn = useServerFn(getAnalysis);
  const { data, isLoading } = useQuery({
    queryKey: ["analysis", id],
    queryFn: () => getFn({ data: { id } }),
    refetchInterval: 10000,
  });

  const [textSearch, setTextSearch] = useState("");

  if (isLoading) return <p className="text-muted-foreground p-8">Carregando análise…</p>;
  if (!data?.assessment) return <p className="text-muted-foreground p-8">Avaliação não encontrada.</p>;

  const { assessment, total, stats, questions } = data;
  const isSurvey = assessment.type === "questionario";

  return (
    <div className="max-w-5xl pb-16">
      <div className="mb-4 flex items-center justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link to="/admin/avaliacoes">
            <ArrowLeft className="mr-1.5 size-4" /> Voltar às Avaliações
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link to="/admin/avaliacoes/$id" params={{ id }}>
            <Edit3 className="mr-1.5 size-4" /> Editar Avaliação
          </Link>
        </Button>
      </div>

      <PageHeader
        title={`Análise: ${assessment.title}`}
        subtitle={`${TYPE_LABEL[assessment.type] ?? assessment.type} · ${total} ${total === 1 ? "resposta concluída" : "respostas concluídas"}`}
        actions={<StatusPill status={assessment.status} />}
      />

      {/* Metrics Cards */}
      {!isSurvey && stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="paper-card p-5">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <TrendingUp className="size-4 text-primary" />
              <p className="text-xs uppercase tracking-wider font-semibold">Média da Turma</p>
            </div>
            <p className="font-display text-4xl font-extrabold text-primary">{stats.media}</p>
            <p className="text-xs text-muted-foreground mt-1">Escala de 0 a 10</p>
          </div>

          <div className="paper-card p-5">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <CheckCircle className="size-4 text-success" />
              <p className="text-xs uppercase tracking-wider font-semibold">Taxa de Aprovação</p>
            </div>
            <p className="font-display text-4xl font-extrabold text-success">{stats.aprovacao}%</p>
            <p className="text-xs text-muted-foreground mt-1">Média mín: {assessment.passing_score}</p>
          </div>

          <div className="paper-card p-5">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Award className="size-4 text-amber-500" />
              <p className="text-xs uppercase tracking-wider font-semibold">Maior Nota</p>
            </div>
            <p className="font-display text-4xl font-extrabold text-amber-600">{stats.maior}</p>
            <p className="text-xs text-muted-foreground mt-1">Menor nota: {stats.menor}</p>
          </div>

          <div className="paper-card p-5">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Users className="size-4 text-blue-500" />
              <p className="text-xs uppercase tracking-wider font-semibold">Participantes</p>
            </div>
            <p className="font-display text-4xl font-extrabold">{total}</p>
            <p className="text-xs text-muted-foreground mt-1">Alunos concluíram</p>
          </div>
        </div>
      )}

      {/* Grade Distribution Chart */}
      {!isSurvey && stats && (
        <div className="paper-card p-6 mb-8">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="size-5 text-primary" />
            <h3 className="font-bold text-lg">Distribuição das Notas</h3>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.distribuicao}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                <XAxis dataKey="faixa" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="n" name="Alunos" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Question by Question Analysis */}
      <div className="space-y-6">
        <h3 className="text-2xl font-bold">Desempenho por Questão</h3>

        {questions.map((q) => {
          const isObjective = ["unica", "multipla", "vf", "escala"].includes(q.type);
          const isOpen = ["curta", "longa"].includes(q.type);
          const totalAnswers = q.answered || total || 1;

          const filteredTexts = q.texts.filter(
            (t) =>
              t.text.toLowerCase().includes(textSearch.toLowerCase()) ||
              t.name.toLowerCase().includes(textSearch.toLowerCase()),
          );

          return (
            <div key={q.id} className="paper-card p-6">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-sm bg-muted size-7 rounded-full flex items-center justify-center">
                    {q.position}
                  </span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-muted text-muted-foreground">
                    {QTYPE_LABEL[q.type as keyof typeof QTYPE_LABEL] ?? q.type}
                  </span>
                  <span className="text-xs text-muted-foreground">{q.answered} respostas</span>
                </div>

                {q.acerto != null && (
                  <span
                    className={`font-mono font-bold text-sm px-2.5 py-0.5 rounded-full ${
                      q.acerto >= 70
                        ? "bg-success/15 text-success"
                        : q.acerto >= 50
                          ? "bg-amber-100 text-amber-800"
                          : "bg-destructive/15 text-destructive"
                    }`}
                  >
                    Taxa de acerto: {q.acerto}%
                  </span>
                )}
              </div>

              <p className="font-semibold text-lg mb-4 whitespace-pre-wrap">{q.prompt}</p>

              {/* Option percentages bar chart for multiple choice & surveys */}
              {isObjective && q.options.length > 0 && (
                <div className="space-y-3">
                  {q.options.map((opt) => {
                    const pct = totalAnswers > 0 ? Math.round((opt.n / totalAnswers) * 100) : 0;
                    return (
                      <div key={opt.id} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium">
                            <span className="font-mono font-bold text-muted-foreground mr-1.5">{opt.id.toUpperCase()})</span>
                            {opt.text}
                          </span>
                          <span className="font-mono font-semibold text-muted-foreground">
                            {opt.n} ({pct}%)
                          </span>
                        </div>
                        <div className="h-3 w-full bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Open-ended responses list */}
              {isOpen && (
                <div className="space-y-3 mt-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <MessageSquare className="size-3.5" /> Respostas dos Alunos ({q.texts.length})
                    </p>
                    {q.texts.length > 3 && (
                      <div className="relative w-48">
                        <Search className="size-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                        <Input
                          placeholder="Buscar respostas…"
                          value={textSearch}
                          onChange={(e) => setTextSearch(e.target.value)}
                          className="h-8 text-xs pl-8"
                        />
                      </div>
                    )}
                  </div>

                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {filteredTexts.map((t, tIdx) => (
                      <div key={tIdx} className="p-3 bg-muted/30 rounded-lg text-sm border">
                        <p className="whitespace-pre-wrap">{t.text}</p>
                        <p className="text-xs text-muted-foreground mt-1.5 font-medium">
                          — {t.name} {t.class_name ? `(${t.class_name})` : ""}
                        </p>
                      </div>
                    ))}
                    {!filteredTexts.length && (
                      <p className="text-xs text-muted-foreground py-4 text-center">Nenhuma resposta registrada ainda.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {!questions.length && (
          <div className="paper-card p-10 text-center text-muted-foreground">
            <p>Nenhuma questão cadastrada para esta avaliação.</p>
          </div>
        )}
      </div>
    </div>
  );
}
