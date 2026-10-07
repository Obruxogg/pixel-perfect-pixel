import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useMemo } from "react";
import { getResults } from "@/lib/admin.functions";
import { PageHeader, StatusPill, fmtTime, fmtDate } from "@/components/AdminShell";
import { TYPE_LABEL } from "@/lib/grading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Search, CheckCircle2, AlertCircle, Clock, Eye } from "lucide-react";

export const Route = createFileRoute("/admin/resultados/")({
  head: () => ({
    meta: [
      { title: "Resultados — giz." },
      { name: "description", content: "Acompanhe e filtre todas as notas e respostas dos alunos." },
      { property: "og:title", content: "Resultados — giz." },
      { property: "og:description", content: "Acompanhe e filtre todas as notas e respostas dos alunos." },
    ],
  }),
  component: ResultsPage,
});

function ResultsPage() {
  const getFn = useServerFn(getResults);
  const { data: results, isLoading } = useQuery({
    queryKey: ["results"],
    queryFn: () => getFn(),
    refetchInterval: 10000,
  });

  const [studentSearch, setStudentSearch] = useState("");
  const [roomFilter, setRoomFilter] = useState("todos");
  const [classFilter, setClassFilter] = useState("todos");
  const [assessmentFilter, setAssessmentFilter] = useState("todos");
  const [typeFilter, setTypeFilter] = useState("todos");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [gradeFilter, setGradeFilter] = useState("todos");

  // Extract unique filter lists
  const roomsList = useMemo(() => {
    if (!results) return [];
    const map = new Map<string, string>();
    results.forEach((r) => {
      if (r.room_id && r.room) map.set(r.room_id, r.room);
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [results]);

  const classesList = useMemo(() => {
    if (!results) return [];
    const set = new Set<string>();
    results.forEach((r) => {
      if (r.class_name && r.class_name !== "—") set.add(r.class_name);
    });
    return Array.from(set);
  }, [results]);

  const assessmentsList = useMemo(() => {
    if (!results) return [];
    const map = new Map<string, string>();
    results.forEach((r) => {
      if (r.assessment_id && r.assessment) map.set(r.assessment_id, r.assessment);
    });
    return Array.from(map.entries()).map(([id, title]) => ({ id, title }));
  }, [results]);

  // Filter rows
  const filtered = useMemo(() => {
    if (!results) return [];
    return results.filter((r) => {
      if (studentSearch && !r.name.toLowerCase().includes(studentSearch.toLowerCase())) return false;
      if (roomFilter !== "todos" && r.room_id !== roomFilter) return false;
      if (classFilter !== "todos" && r.class_name !== classFilter) return false;
      if (assessmentFilter !== "todos" && r.assessment_id !== assessmentFilter) return false;
      if (typeFilter !== "todos" && r.type !== typeFilter) return false;
      if (statusFilter !== "todos" && r.status !== statusFilter) return false;
      if (gradeFilter === "aprovados" && (r.aprovado !== true || r.nota == null)) return false;
      if (gradeFilter === "abaixo" && (r.aprovado !== false || r.nota == null)) return false;
      if (gradeFilter === "revisar" && !r.needs_review) return false;
      return true;
    });
  }, [results, studentSearch, roomFilter, classFilter, assessmentFilter, typeFilter, statusFilter, gradeFilter]);

  // Aggregate stats of filtered view
  const stats = useMemo(() => {
    const total = filtered.length;
    const graded = filtered.filter((r) => r.nota != null);
    const sum = graded.reduce((acc, r) => acc + (r.nota ?? 0), 0);
    const avg = graded.length ? Math.round((sum / graded.length) * 10) / 10 : null;
    const approved = graded.filter((r) => r.aprovado).length;
    const passRate = graded.length ? Math.round((approved / graded.length) * 100) : null;
    const pendingReview = filtered.filter((r) => r.needs_review).length;
    return { total, avg, passRate, pendingReview };
  }, [filtered]);

  function exportCSV() {
    if (!filtered.length) return;
    const headers = ["Aluno", "Turma", "Sala", "Avaliação", "Tipo", "Status", "Início", "Conclusão", "Nota", "Situação"];
    const rows = filtered.map((r) => [
      `"${r.name.replace(/"/g, '""')}"`,
      `"${r.class_name.replace(/"/g, '""')}"`,
      `"${r.room.replace(/"/g, '""')}"`,
      `"${r.assessment.replace(/"/g, '""')}"`,
      `"${TYPE_LABEL[r.type] ?? r.type}"`,
      `"${r.status}"`,
      `"${r.started_at ? new Date(r.started_at).toLocaleString("pt-BR") : ""}"`,
      `"${r.submitted_at ? new Date(r.submitted_at).toLocaleString("pt-BR") : ""}"`,
      r.nota != null ? r.nota : "",
      r.aprovado == null ? "" : r.aprovado ? "Aprovado" : "Abaixo da Média",
    ]);

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `resultados_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <PageHeader
        title="Resultados"
        subtitle="Consulte, filtre e analise as notas e respostas de todos os alunos."
        actions={
          <Button variant="chalk" onClick={exportCSV} disabled={!filtered.length}>
            <Download className="mr-1.5 size-4" /> Exportar Planilha (CSV)
          </Button>
        }
      />

      {/* Metrics overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="paper-card p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Envios Filtrados</p>
          <p className="font-display text-3xl font-extrabold mt-1">{stats.total}</p>
        </div>
        <div className="paper-card p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Média Geral</p>
          <p className="font-display text-3xl font-extrabold mt-1 text-primary">{stats.avg ?? "—"}</p>
        </div>
        <div className="paper-card p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Taxa de Aprovação</p>
          <p className="font-display text-3xl font-extrabold mt-1 text-success">
            {stats.passRate != null ? `${stats.passRate}%` : "—"}
          </p>
        </div>
        <div className="paper-card p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Aguardando Correção</p>
          <p className="font-display text-3xl font-extrabold mt-1 text-amber-600">{stats.pendingReview}</p>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="paper-card p-4 mb-6 space-y-3">
        <div className="flex items-center gap-2">
          <Search className="size-4 text-muted-foreground" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Filtros Avançados</span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Input
            placeholder="Filtrar por nome do aluno…"
            value={studentSearch}
            onChange={(e) => setStudentSearch(e.target.value)}
          />

          <Select value={roomFilter} onValueChange={setRoomFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Sala" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas as salas</SelectItem>
              {roomsList.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={classFilter} onValueChange={setClassFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Turma" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas as turmas</SelectItem>
              {classesList.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={assessmentFilter} onValueChange={setAssessmentFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Avaliação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas as avaliações</SelectItem>
              {assessmentsList.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 pt-2 border-t">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os tipos</SelectItem>
              <SelectItem value="prova">Prova</SelectItem>
              <SelectItem value="atividade">Atividade</SelectItem>
              <SelectItem value="questionario">Questionário</SelectItem>
              <SelectItem value="diagnostico">Diagnóstico</SelectItem>
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Status do envio" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              <SelectItem value="concluida">Concluída</SelectItem>
              <SelectItem value="em_andamento">Em andamento</SelectItem>
            </SelectContent>
          </Select>

          <Select value={gradeFilter} onValueChange={setGradeFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Desempenho" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas as notas</SelectItem>
              <SelectItem value="aprovados">Aprovados (Acima da média)</SelectItem>
              <SelectItem value="abaixo">Abaixo da média</SelectItem>
              <SelectItem value="revisar">Pendente de correção manual</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Results Table */}
      <div className="paper-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-muted-foreground border-b bg-muted/30">
            <tr>
              <th className="px-4 py-3 font-semibold">Aluno</th>
              <th className="px-4 py-3 font-semibold">Turma</th>
              <th className="px-4 py-3 font-semibold">Sala</th>
              <th className="px-4 py-3 font-semibold">Avaliação</th>
              <th className="px-4 py-3 font-semibold">Horário</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Nota</th>
              <th className="px-4 py-3 font-semibold text-right">Ação</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-b last:border-0 hover:bg-muted/10 transition">
                <td className="px-4 py-3 font-semibold">
                  <Link to="/admin/resultados/$id" params={{ id: r.id }} className="hover:underline flex items-center gap-1.5">
                    {r.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{r.class_name}</td>
                <td className="px-4 py-3 text-xs font-mono">{r.room}</td>
                <td className="px-4 py-3">
                  <span className="font-medium">{r.assessment}</span>
                  <span className="text-xs text-muted-foreground block">{TYPE_LABEL[r.type] ?? r.type}</span>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
                  {fmtDate(r.submitted_at || r.started_at)} {fmtTime(r.submitted_at || r.started_at)}
                </td>
                <td className="px-4 py-3">
                  <StatusPill status={r.status} />
                </td>
                <td className="px-4 py-3 font-mono font-bold">
                  {r.needs_review ? (
                    <span className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300">
                      Corrigir
                    </span>
                  ) : r.nota != null ? (
                    <span className={`inline-flex items-center gap-1 ${r.aprovado ? "text-success" : "text-destructive"}`}>
                      {r.nota}
                      {r.aprovado ? <CheckCircle2 className="size-3.5" /> : <AlertCircle className="size-3.5" />}
                    </span>
                  ) : (
                    <span className="text-muted-foreground font-normal text-xs">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <Button asChild variant="outline" size="sm" className="h-8 text-xs">
                    <Link to="/admin/resultados/$id" params={{ id: r.id }}>
                      <Eye className="size-3.5 mr-1" /> {r.needs_review ? "Corrigir" : "Ver"}
                    </Link>
                  </Button>
                </td>
              </tr>
            ))}

            {isLoading && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                  Carregando resultados…
                </td>
              </tr>
            )}

            {!isLoading && !filtered.length && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                  Nenhum resultado encontrado para os filtros selecionados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
