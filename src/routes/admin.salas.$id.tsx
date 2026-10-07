import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { getRoomLive, updateRoomStatus, deleteRoom, createAssessment } from "@/lib/admin.functions";
import { PageHeader, StatusPill, fmtTime } from "@/components/AdminShell";
import { TYPE_LABEL, toTen } from "@/lib/grading";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MonitorUp, RefreshCw, Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/admin/salas/$id")({
  head: () => ({ meta: [{ title: "Sala — giz." }, { name: "description", content: "Modo aula e acompanhamento da sala." }, { property: "og:title", content: "Sala — giz." }, { property: "og:description", content: "Modo aula e acompanhamento da sala." }] }),
  component: RoomDetail,
});

function RoomDetail() {
  const { id } = Route.useParams();
  const fn = useServerFn(getRoomLive);
  const { data, refetch, isFetching } = useQuery({ queryKey: ["room", id], queryFn: () => fn({ data: { id } }), refetchInterval: 5000 });
  const setStatus = useServerFn(updateRoomStatus);
  const del = useServerFn(deleteRoom);
  const create = useServerFn(createAssessment);
  const qc = useQueryClient();
  const nav = useNavigate();
  const [sel, setSel] = useState<string>("");

  const assessmentId = sel || data?.assessments.find((a) => a.status === "disponivel")?.id || data?.assessments[0]?.id || "";
  const rows = useMemo(() => {
    if (!data) return [];
    return data.participants.map((p) => {
      const subs = data.submissions.filter((s) => s.participant_id === p.id && s.assessment_id === assessmentId);
      const sub = subs.find((s) => s.status === "concluida") ?? subs[0];
      return { p, sub, status: sub ? sub.status : "nao_iniciada" };
    });
  }, [data, assessmentId]);

  if (!data) return <p className="text-muted-foreground">{data === null ? "Sala não encontrada." : "Carregando…"}</p>;
  const { room } = data;
  const started = rows.filter((r) => r.sub).length, doneN = rows.filter((r) => r.status === "concluida").length;

  async function changeStatus(status: "rascunho" | "ativa" | "encerrada" | "arquivada") {
    await setStatus({ data: { id: room.id, status } }); refetch(); qc.invalidateQueries({ queryKey: ["rooms"] });
    toast.success("Status atualizado");
  }

  return (
    <div>
      <PageHeader title={room.name} subtitle={`${room.class_name || "Sem turma"}${room.description ? " · " + room.description : ""}`} actions={<>
        <Select value={room.status} onValueChange={(v) => changeStatus(v as "ativa")}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>{["rascunho", "ativa", "encerrada", "arquivada"].map((s) => <SelectItem key={s} value={s}><StatusPill status={s} /></SelectItem>)}</SelectContent>
        </Select>
        <Button asChild variant="chalk"><Link to="/projetar/$id" params={{ id: room.id }} target="_blank"><MonitorUp /> Exibir para os alunos</Link></Button>
        <Button variant="ghost" size="icon" aria-label="Excluir sala" onClick={async () => { if (confirm("Excluir esta sala e todos os registros dela?")) { await del({ data: { id: room.id } }); qc.invalidateQueries({ queryKey: ["rooms"] }); nav({ to: "/admin/salas" }); } }}><Trash2 /></Button>
      </>} />

      {room.status !== "ativa" && <p className="mb-4 rounded-lg bg-accent/20 border border-accent px-4 py-2 text-sm">Esta sala está <b>{room.status}</b>. Os alunos só conseguem entrar quando ela está <b>ativa</b>.</p>}

      <section className="chalk-texture text-board-foreground rounded-2xl p-6 md:p-8">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-board-muted">Modo aula · Código</p>
            <p className="font-mono text-5xl md:text-6xl font-extrabold tracking-widest text-accent">{room.code}</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={assessmentId} onValueChange={setSel}>
              <SelectTrigger className="w-64 bg-board-foreground/10 border-board-foreground/20 text-board-foreground"><SelectValue placeholder="Sem avaliações" /></SelectTrigger>
              <SelectContent>{data.assessments.map((a) => <SelectItem key={a.id} value={a.id}>{a.title}</SelectItem>)}</SelectContent>
            </Select>
            <Button variant="ghost" size="icon" onClick={() => refetch()} aria-label="Atualizar" className="text-board-foreground hover:bg-board-foreground/10"><RefreshCw className={isFetching ? "animate-spin" : ""} /></Button>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-6">
          {[["Entraram", rows.length], ["Iniciaram", started], ["Concluíram", doneN], ["Realizando", started - doneN], ["Não iniciaram", rows.length - started]].map(([l, v]) => (
            <div key={l as string} className="rounded-xl bg-board-foreground/5 p-4"><p className="font-display text-4xl font-extrabold">{v}</p><p className="text-sm text-board-muted">{l}</p></div>
          ))}
        </div>
      </section>

      <div className="paper-card mt-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-muted-foreground"><tr className="border-b">{["Aluno", "Turma", "Status", "Início", "Conclusão", "Nota"].map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}</tr></thead>
          <tbody>
            {rows.map(({ p, sub, status }) => (
              <tr key={p.id} className="border-b last:border-0">
                <td className="px-4 py-3 font-semibold">{sub ? <Link to="/admin/resultados/$id" params={{ id: sub.id }} className="hover:underline">{p.name}</Link> : p.name}</td>
                <td className="px-4 py-3">{p.class_name}</td>
                <td className="px-4 py-3"><StatusPill status={status} /></td>
                <td className="px-4 py-3 font-mono">{fmtTime(sub?.started_at)}</td>
                <td className="px-4 py-3 font-mono">{fmtTime(sub?.submitted_at)}</td>
                <td className="px-4 py-3 font-mono">{sub?.needs_review ? "corrigir" : toTen(sub?.score, sub?.max_score) ?? "—"}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Nenhum aluno entrou ainda.</td></tr>}
          </tbody>
        </table>
      </div>

      <section className="mt-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-bold">Avaliações da sala</h2>
          <Button variant="outline" onClick={async () => { const r = await create({ data: { type: "prova", room_id: room.id } }); nav({ to: "/admin/avaliacoes/$id", params: { id: r.id } }); }}><Plus /> Nova avaliação</Button>
        </div>
        <ul className="paper-card divide-y">
          {data.assessments.map((a) => (
            <li key={a.id} className="px-4 py-3 flex items-center justify-between gap-3">
              <Link to="/admin/avaliacoes/$id" params={{ id: a.id }} className="font-semibold hover:underline">{a.title} <span className="text-muted-foreground font-normal text-sm">· {TYPE_LABEL[a.type]}</span></Link>
              <div className="flex items-center gap-3"><StatusPill status={a.status} /><Link to="/admin/analise/$id" params={{ id: a.id }} className="text-sm underline">Resultados</Link></div>
            </li>
          ))}
          {!data.assessments.length && <li className="px-4 py-6 text-muted-foreground text-sm">Nenhuma avaliação vinculada. Crie uma ou vincule uma existente pela tela da avaliação.</li>}
        </ul>
      </section>
    </div>
  );
}
