import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useMemo } from "react";
import { getResults, listRooms } from "@/lib/admin.functions";
import { PageHeader, fmtDate } from "@/components/AdminShell";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Printer, Download, FileText, AlertTriangle, CheckCircle, TrendingUp, Users } from "lucide-react";

export const Route = createFileRoute("/admin/relatorios")({
  head: () => ({
    meta: [
      { title: "Relatórios — giz." },
      { name: "description", content: "Relatórios de desempenho por sala, turma e alunos em recuperação." },
      { property: "og:title", content: "Relatórios — giz." },
      { property: "og:description", content: "Relatórios de desempenho por sala, turma e alunos em recuperação." },
    ],
  }),
  component: ReportsPage,
});

function ReportsPage() {
  const getFn = useServerFn(getResults);
  const roomsFn = useServerFn(listRooms);

  const { data: results } = useQuery({ queryKey: ["results"], queryFn: () => getFn() });
  const { data: rooms } = useQuery({ queryKey: ["rooms"], queryFn: () => roomsFn() });

  const [reportType, setReportType] = useState<"geral" | "salas" | "turmas" | "recuperacao">("geral");
  const [selectedRoom, setSelectedRoom] = useState<string>("todas");

  // Filtered by room if applicable
  const filtered = useMemo(() => {
    if (!results) return [];
    if (selectedRoom === "todas") return results;
    return results.filter((r) => r.room_id === selectedRoom);
  }, [results, selectedRoom]);

  // Students below average (Alunos abaixo da média)
  const belowAverageStudents = useMemo(() => {
    return filtered.filter((r) => r.nota != null && r.aprovado === false);
  }, [filtered]);

  // Performance grouped by Class
  const classBreakdown = useMemo(() => {
    const map = new Map<string, { total: number; sum: number; countGraded: number; approved: number }>();
    filtered.forEach((r) => {
      const cls = r.class_name || "Sem Turma";
      const cur = map.get(cls) ?? { total: 0, sum: 0, countGraded: 0, approved: 0 };
      cur.total += 1;
      if (r.nota != null) {
        cur.sum += r.nota;
        cur.countGraded += 1;
        if (r.aprovado) cur.approved += 1;
      }
      map.set(cls, cur);
    });

    return Array.from(map.entries()).map(([className, data]) => ({
      className,
      total: data.total,
      avg: data.countGraded ? Math.round((data.sum / data.countGraded) * 10) / 10 : null,
      passRate: data.countGraded ? Math.round((data.approved / data.countGraded) * 100) : null,
    }));
  }, [filtered]);

  // Performance grouped by Room
  const roomBreakdown = useMemo(() => {
    const map = new Map<string, { roomName: string; total: number; sum: number; countGraded: number; approved: number }>();
    filtered.forEach((r) => {
      const rid = r.room_id || "outras";
      const cur = map.get(rid) ?? { roomName: r.room || "Outras", total: 0, sum: 0, countGraded: 0, approved: 0 };
      cur.total += 1;
      if (r.nota != null) {
        cur.sum += r.nota;
        cur.countGraded += 1;
        if (r.aprovado) cur.approved += 1;
      }
      map.set(rid, cur);
    });

    return Array.from(map.entries()).map(([roomId, data]) => ({
      roomId,
      roomName: data.roomName,
      total: data.total,
      avg: data.countGraded ? Math.round((data.sum / data.countGraded) * 10) / 10 : null,
      passRate: data.countGraded ? Math.round((data.approved / data.countGraded) * 100) : null,
    }));
  }, [filtered]);

  function handlePrint() {
    window.print();
  }

  return (
    <div className="max-w-5xl pb-16">
      <div className="print:hidden">
        <PageHeader
          title="Relatórios"
          subtitle="Gere sínteses de rendimento escolar, notas e acompanhamento pedagógico."
          actions={
            <div className="flex gap-2">
              <Button variant="outline" onClick={handlePrint}>
                <Printer className="size-4 mr-1.5" /> Imprimir / Salvar PDF
              </Button>
            </div>
          }
        />

        {/* Filter controls */}
        <div className="flex flex-wrap gap-3 mb-6">
          <Select value={reportType} onValueChange={(v) => setReportType(v as typeof reportType)}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Tipo de Relatório" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="geral">Visão Geral de Desempenho</SelectItem>
              <SelectItem value="salas">Desempenho por Sala</SelectItem>
              <SelectItem value="turmas">Desempenho por Turma</SelectItem>
              <SelectItem value="recuperacao">Alunos Abaixo da Média</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedRoom} onValueChange={setSelectedRoom}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder="Filtrar Sala" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as salas</SelectItem>
              {(rooms ?? []).map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name} ({r.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Printable Report Document Body */}
      <div className="paper-card p-8 print:border-none print:shadow-none print:p-0">
        <div className="border-b pb-4 mb-6">
          <div className="flex justify-between items-start">
            <div>
              <p className="font-display font-bold text-2xl">giz<span className="text-accent">.</span></p>
              <h1 className="text-2xl font-extrabold mt-1">
                {reportType === "geral" && "Relatório Geral de Desempenho"}
                {reportType === "salas" && "Relatório Consolidado por Sala"}
                {reportType === "turmas" && "Relatório Consolidado por Turma"}
                {reportType === "recuperacao" && "Relatório de Alunos com Desempenho Insuficiente"}
              </h1>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              <p>Gerado em: {new Date().toLocaleDateString("pt-BR")}</p>
              <p>Escola / Professor Responsável</p>
            </div>
          </div>
        </div>

        {/* Report: Geral */}
        {reportType === "geral" && (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-muted/40 border">
                <p className="text-xs uppercase text-muted-foreground font-semibold">Total de Avaliações Enviadas</p>
                <p className="text-3xl font-extrabold mt-1">{filtered.length}</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/40 border">
                <p className="text-xs uppercase text-muted-foreground font-semibold">Alunos Abaixo da Média</p>
                <p className="text-3xl font-extrabold mt-1 text-destructive">{belowAverageStudents.length}</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/40 border">
                <p className="text-xs uppercase text-muted-foreground font-semibold">Taxa Geral de Aprovação</p>
                <p className="text-3xl font-extrabold mt-1 text-success">
                  {filtered.length
                    ? Math.round((filtered.filter((r) => r.aprovado).length / (filtered.filter((r) => r.nota != null).length || 1)) * 100)
                    : 0}%
                </p>
              </div>
            </div>

            <div>
              <h3 className="font-bold text-lg mb-3">Últimas Avaliações Registradas</h3>
              <table className="w-full text-xs text-left border">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="p-2.5">Aluno</th>
                    <th className="p-2.5">Turma</th>
                    <th className="p-2.5">Avaliação</th>
                    <th className="p-2.5">Data</th>
                    <th className="p-2.5">Nota</th>
                    <th className="p-2.5">Situação</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.slice(0, 20).map((r) => (
                    <tr key={r.id}>
                      <td className="p-2.5 font-medium">{r.name}</td>
                      <td className="p-2.5">{r.class_name}</td>
                      <td className="p-2.5">{r.assessment}</td>
                      <td className="p-2.5">{fmtDate(r.submitted_at || r.started_at)}</td>
                      <td className="p-2.5 font-mono font-bold">{r.nota ?? "—"}</td>
                      <td className="p-2.5">
                        {r.aprovado == null ? "—" : r.aprovado ? <span className="text-success font-semibold">Aprovado</span> : <span className="text-destructive font-semibold">Abaixo da média</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Report: Por Turma */}
        {reportType === "turmas" && (
          <div className="space-y-4">
            <table className="w-full text-sm text-left border">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="p-3">Turma</th>
                  <th className="p-3">Total de Participações</th>
                  <th className="p-3">Média Geral</th>
                  <th className="p-3">Taxa de Aprovação</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {classBreakdown.map((c) => (
                  <tr key={c.className}>
                    <td className="p-3 font-bold">{c.className}</td>
                    <td className="p-3">{c.total}</td>
                    <td className="p-3 font-mono font-bold">{c.avg ?? "—"}</td>
                    <td className="p-3 font-mono text-success font-bold">{c.passRate != null ? `${c.passRate}%` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Report: Por Sala */}
        {reportType === "salas" && (
          <div className="space-y-4">
            <table className="w-full text-sm text-left border">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="p-3">Sala</th>
                  <th className="p-3">Total de Envios</th>
                  <th className="p-3">Média da Sala</th>
                  <th className="p-3">Aprovação</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {roomBreakdown.map((r) => (
                  <tr key={r.roomId}>
                    <td className="p-3 font-bold">{r.roomName}</td>
                    <td className="p-3">{r.total}</td>
                    <td className="p-3 font-mono font-bold">{r.avg ?? "—"}</td>
                    <td className="p-3 font-mono text-success font-bold">{r.passRate != null ? `${r.passRate}%` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Report: Alunos em Recuperação */}
        {reportType === "recuperacao" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Lista nominal de alunos que obtiveram nota inferior à média mínima estabelecida ({belowAverageStudents.length} registros).
            </p>
            <table className="w-full text-sm text-left border">
              <thead className="bg-destructive/10 border-b text-destructive font-semibold">
                <tr>
                  <th className="p-3">Nome do Aluno</th>
                  <th className="p-3">Turma</th>
                  <th className="p-3">Avaliação</th>
                  <th className="p-3">Sala</th>
                  <th className="p-3">Nota Obtida</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {belowAverageStudents.map((r) => (
                  <tr key={r.id}>
                    <td className="p-3 font-bold">{r.name}</td>
                    <td className="p-3">{r.class_name}</td>
                    <td className="p-3">{r.assessment}</td>
                    <td className="p-3 font-mono text-xs">{r.room}</td>
                    <td className="p-3 font-mono font-bold text-destructive">{r.nota}</td>
                  </tr>
                ))}
                {!belowAverageStudents.length && (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-muted-foreground">
                      Nenhum aluno com nota abaixo da média registrado!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
