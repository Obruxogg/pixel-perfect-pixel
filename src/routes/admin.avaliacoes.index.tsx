import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { listAssessments, createAssessment, duplicateAssessment, deleteAssessment, listRooms } from "@/lib/admin.functions";
import { PageHeader, StatusPill } from "@/components/AdminShell";
import { TYPE_LABEL } from "@/lib/grading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, Copy, Trash2, Edit3, BarChart2, DoorOpen, HelpCircle, FileCheck } from "lucide-react";

export const Route = createFileRoute("/admin/avaliacoes/")({
  head: () => ({
    meta: [
      { title: "Avaliações — giz." },
      { name: "description", content: "Gerencie provas, atividades, questionários e diagnósticos." },
      { property: "og:title", content: "Avaliações — giz." },
      { property: "og:description", content: "Gerencie provas, atividades, questionários e diagnósticos." },
    ],
  }),
  component: AssessmentsList,
});

function AssessmentsList() {
  const listFn = useServerFn(listAssessments);
  const roomsFn = useServerFn(listRooms);
  const createFn = useServerFn(createAssessment);
  const dupFn = useServerFn(duplicateAssessment);
  const delFn = useServerFn(deleteAssessment);
  const qc = useQueryClient();
  const nav = useNavigate();

  const { data: assessments } = useQuery({ queryKey: ["assessments"], queryFn: () => listFn() });
  const { data: rooms } = useQuery({ queryKey: ["rooms"], queryFn: () => roomsFn() });

  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState("todos");
  const [roomFilter, setRoomFilter] = useState("todos");
  const [statusFilter, setStatusFilter] = useState("todos");

  const filtered = (assessments ?? []).filter((a) => {
    if (q && !a.title.toLowerCase().includes(q.toLowerCase()) && !(a.room?.name ?? "").toLowerCase().includes(q.toLowerCase())) return false;
    if (typeFilter !== "todos" && a.type !== typeFilter) return false;
    if (roomFilter !== "todos" && a.room_id !== roomFilter) return false;
    if (statusFilter !== "todos" && a.status !== statusFilter) return false;
    return true;
  });

  async function handleCreate(type: "prova" | "atividade" | "questionario" | "diagnostico") {
    try {
      const res = await createFn({ data: { type } });
      qc.invalidateQueries({ queryKey: ["assessments"] });
      nav({ to: "/admin/avaliacoes/$id", params: { id: res.id } });
    } catch {
      toast.error("Erro ao criar avaliação.");
    }
  }

  async function handleDuplicate(id: string) {
    try {
      const res = await dupFn({ data: { id } });
      qc.invalidateQueries({ queryKey: ["assessments"] });
      toast.success("Avaliação duplicada como rascunho.");
      nav({ to: "/admin/avaliacoes/$id", params: { id: res.id } });
    } catch {
      toast.error("Erro ao duplicar avaliação.");
    }
  }

  async function handleDelete(id: string, title: string) {
    if (!confirm(`Deseja realmente excluir "${title}" e todos os envios dela?`)) return;
    try {
      await delFn({ data: { id } });
      qc.invalidateQueries({ queryKey: ["assessments"] });
      toast.success("Avaliação excluída.");
    } catch {
      toast.error("Erro ao excluir avaliação.");
    }
  }

  return (
    <div>
      <PageHeader
        title="Avaliações"
        subtitle="Crie e gerencie provas, atividades, questionários e diagnósticos."
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="chalk">
                <Plus className="mr-1 size-4" /> Nova Avaliação
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleCreate("prova")}>
                <FileCheck className="mr-2 size-4 text-blue-600" /> Nova Prova
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleCreate("atividade")}>
                <FileCheck className="mr-2 size-4 text-amber-600" /> Nova Atividade
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleCreate("questionario")}>
                <HelpCircle className="mr-2 size-4 text-emerald-600" /> Novo Questionário
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleCreate("diagnostico")}>
                <BarChart2 className="mr-2 size-4 text-purple-600" /> Nova Avaliação Diagnóstica
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      {/* Filters Bar */}
      <div className="flex flex-wrap gap-3 mb-6">
        <Input
          placeholder="Buscar por título ou sala…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full sm:w-64"
        />
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-40">
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

        <Select value={roomFilter} onValueChange={setRoomFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Sala" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas as salas</SelectItem>
            {(rooms ?? []).map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.name} ({r.code})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            <SelectItem value="rascunho">Rascunho</SelectItem>
            <SelectItem value="disponivel">Disponível</SelectItem>
            <SelectItem value="encerrada">Encerrada</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Evaluations Grid / Cards */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((a) => (
          <div
            key={a.id}
            className="paper-card p-5 flex flex-col justify-between hover:ring-2 hover:ring-accent transition"
          >
            <div>
              <div className="flex items-start justify-between gap-2 mb-2">
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-muted text-muted-foreground uppercase tracking-wider">
                  {TYPE_LABEL[a.type] ?? a.type}
                </span>
                <StatusPill status={a.status} />
              </div>
              <h3 className="font-bold text-lg leading-tight mb-2">
                <Link to="/admin/avaliacoes/$id" params={{ id: a.id }} className="hover:underline">
                  {a.title}
                </Link>
              </h3>
              {a.description && (
                <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                  {a.description}
                </p>
              )}
              <div className="text-xs text-muted-foreground space-y-1 mt-3 pt-3 border-t">
                <div className="flex items-center gap-1.5">
                  <DoorOpen className="size-3.5" />
                  {a.room ? (
                    <Link to="/admin/salas/$id" params={{ id: a.room.id }} className="hover:underline font-medium text-foreground">
                      {a.room.name} <span className="font-mono text-accent">({a.room.code})</span>
                    </Link>
                  ) : (
                    <span className="italic">Nenhuma sala vinculada</span>
                  )}
                </div>
                <div className="flex justify-between items-center pt-1">
                  <span>{a.questions} {a.questions === 1 ? "questão" : "questões"}</span>
                  <span className="font-semibold text-foreground">{a.responses} {a.responses === 1 ? "resposta" : "respostas"}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 mt-5 pt-3 border-t">
              <div className="flex gap-1">
                <Button asChild variant="outline" size="sm">
                  <Link to="/admin/avaliacoes/$id" params={{ id: a.id }}>
                    <Edit3 className="size-3.5 mr-1" /> Editar
                  </Link>
                </Button>
                <Button asChild variant="ghost" size="sm">
                  <Link to="/admin/analise/$id" params={{ id: a.id }}>
                    <BarChart2 className="size-3.5 mr-1" /> Análise
                  </Link>
                </Button>
              </div>

              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  title="Duplicar avaliação"
                  onClick={() => handleDuplicate(a.id)}
                >
                  <Copy className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-destructive hover:bg-destructive/10"
                  title="Excluir"
                  onClick={() => handleDelete(a.id, a.title)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          </div>
        ))}
        {assessments && !filtered.length && (
          <div className="col-span-full paper-card p-10 text-center text-muted-foreground">
            <p className="font-medium text-lg">Nenhuma avaliação encontrada.</p>
            <p className="text-sm mt-1">Crie uma nova avaliação ou ajuste seus filtros de busca.</p>
          </div>
        )}
      </div>
    </div>
  );
}
