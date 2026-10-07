import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  getRoomLive,
  updateRoomStatus,
  deleteRoom,
  createAssessment,
  listAssessments,
  linkAssessmentToRoom,
  unlinkAssessmentFromRoom,
  cloneAssessmentToRoom,
} from "@/lib/admin.functions";
import { PageHeader, StatusPill, fmtTime } from "@/components/AdminShell";
import { TYPE_LABEL, toTen } from "@/lib/grading";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { MonitorUp, RefreshCw, Plus, Trash2, Link as LinkIcon, Unlink, Copy, Library } from "lucide-react";

export const Route = createFileRoute("/admin/salas/$id")({
  head: () => ({
    meta: [
      { title: "Sala — giz." },
      { name: "description", content: "Modo aula e acompanhamento da sala." },
      { property: "og:title", content: "Sala — giz." },
      { property: "og:description", content: "Modo aula e acompanhamento da sala." },
    ],
  }),
  component: RoomDetail,
});

function RoomDetail() {
  const { id } = Route.useParams();
  const fn = useServerFn(getRoomLive);
  const { data, refetch, isFetching } = useQuery({
    queryKey: ["room", id],
    queryFn: () => fn({ data: { id } }),
    refetchInterval: 5000,
  });

  const listAllAssessmentsFn = useServerFn(listAssessments);
  const { data: allAssessments } = useQuery({
    queryKey: ["assessments"],
    queryFn: () => listAllAssessmentsFn(),
  });

  const setStatus = useServerFn(updateRoomStatus);
  const del = useServerFn(deleteRoom);
  const create = useServerFn(createAssessment);
  const linkFn = useServerFn(linkAssessmentToRoom);
  const unlinkFn = useServerFn(unlinkAssessmentFromRoom);
  const cloneFn = useServerFn(cloneAssessmentToRoom);

  const qc = useQueryClient();
  const nav = useNavigate();
  const [sel, setSel] = useState<string>("");
  const [linkModalOpen, setLinkModalOpen] = useState(false);

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
  const started = rows.filter((r) => r.sub).length,
    doneN = rows.filter((r) => r.status === "concluida").length;

  async function changeStatus(status: "rascunho" | "ativa" | "encerrada" | "arquivada") {
    await setStatus({ data: { id: room.id, status } });
    refetch();
    qc.invalidateQueries({ queryKey: ["rooms"] });
    toast.success("Status atualizado");
  }

  async function handleUnlinkAssessment(assessmentIdToUnlink: string) {
    if (!confirm("Deseja desvincular esta avaliação da sala? A avaliação continuará salva na sua lista.")) return;
    try {
      await unlinkFn({ data: { id: assessmentIdToUnlink } });
      refetch();
      qc.invalidateQueries({ queryKey: ["assessments"] });
      toast.success("Avaliação desvinculada da sala.");
    } catch {
      toast.error("Erro ao desvincular.");
    }
  }

  async function handleLinkExisting(assessmentIdToLink: string, asClone: boolean) {
    try {
      if (asClone) {
        await cloneFn({ data: { id: assessmentIdToLink, roomId: room.id } });
        toast.success("Cópia da avaliação criada e vinculada a esta sala!");
      } else {
        await linkFn({ data: { id: assessmentIdToLink, roomId: room.id } });
        toast.success("Avaliação vinculada à sala!");
      }
      refetch();
      qc.invalidateQueries({ queryKey: ["assessments"] });
      setLinkModalOpen(false);
    } catch {
      toast.error("Erro ao vincular avaliação.");
    }
  }

  // Filter available assessments not already in this room
  const unlinkedAssessments = (allAssessments ?? []).filter((a) => a.room_id !== room.id);

  return (
    <div>
      <PageHeader
        title={room.name}
        subtitle={`${room.class_name || "Sem turma"}${room.description ? " · " + room.description : ""}`}
        actions={
          <>
            <Select value={room.status} onValueChange={(v) => changeStatus(v as "ativa")}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["rascunho", "ativa", "encerrada", "arquivada"].map((s) => (
                  <SelectItem key={s} value={s}>
                    <StatusPill status={s} />
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button asChild variant="chalk">
              <Link to="/projetar/$id" params={{ id: room.id }} target="_blank">
                <MonitorUp className="size-4 mr-1.5" /> Exibir para os alunos
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Excluir sala"
              onClick={async () => {
                if (confirm("Excluir esta sala e todos os registros dela?")) {
                  await del({ data: { id: room.id } });
                  qc.invalidateQueries({ queryKey: ["rooms"] });
                  nav({ to: "/admin/salas" });
                }
              }}
            >
              <Trash2 className="size-4" />
            </Button>
          </>
        }
      />

      {room.status !== "ativa" && (
        <p className="mb-4 rounded-lg bg-accent/20 border border-accent px-4 py-2 text-sm">
          Esta sala está <b>{room.status}</b>. Os alunos só conseguem entrar quando ela está <b>ativa</b>.
        </p>
      )}

      {/* Classroom Mode Billboard */}
      <section className="chalk-texture text-board-foreground rounded-2xl p-6 md:p-8">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-board-muted">Modo aula · Código da Sala</p>
            <p className="font-mono text-5xl md:text-6xl font-extrabold tracking-widest text-accent">{room.code}</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={assessmentId} onValueChange={setSel}>
              <SelectTrigger className="w-64 bg-board-foreground/10 border-board-foreground/20 text-board-foreground">
                <SelectValue placeholder="Sem avaliações" />
              </SelectTrigger>
              <SelectContent>
                {data.assessments.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => refetch()}
              aria-label="Atualizar"
              className="text-board-foreground hover:bg-board-foreground/10"
            >
              <RefreshCw className={`size-4 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-6">
          {[
            ["Entraram", rows.length],
            ["Iniciaram", started],
            ["Concluíram", doneN],
            ["Realizando", started - doneN],
            ["Não iniciaram", rows.length - started],
          ].map(([l, v]) => (
            <div key={l as string} className="rounded-xl bg-board-foreground/5 p-4">
              <p className="font-display text-4xl font-extrabold">{v}</p>
              <p className="text-sm text-board-muted">{l}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Live Participants Table */}
      <div className="paper-card mt-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-muted-foreground border-b bg-muted/30">
            <tr>
              {["Aluno", "Turma", "Status", "Início", "Conclusão", "Nota"].map((h) => (
                <th key={h} className="px-4 py-3 font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ p, sub, status }) => (
              <tr key={p.id} className="border-b last:border-0 hover:bg-muted/10 transition">
                <td className="px-4 py-3 font-semibold">
                  {sub ? (
                    <Link to="/admin/resultados/$id" params={{ id: sub.id }} className="hover:underline">
                      {p.name}
                    </Link>
                  ) : (
                    p.name
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{p.class_name}</td>
                <td className="px-4 py-3">
                  <StatusPill status={status} />
                </td>
                <td className="px-4 py-3 font-mono text-xs">{fmtTime(sub?.started_at)}</td>
                <td className="px-4 py-3 font-mono text-xs">{fmtTime(sub?.submitted_at)}</td>
                <td className="px-4 py-3 font-mono font-bold">
                  {sub?.needs_review ? (
                    <span className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-800">corrigir</span>
                  ) : (
                    toTen(sub?.score, sub?.max_score) ?? "—"
                  )}
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  Nenhum aluno entrou nesta sala ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modular Assessments in Room Section */}
      <section className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div>
            <h2 className="text-xl font-bold">Avaliações Disponíveis na Sala</h2>
            <p className="text-xs text-muted-foreground">
              Os alunos que entrarem com o código <b className="font-mono text-foreground">{room.code}</b> verão estas
              atividades.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setLinkModalOpen(true)}>
              <LinkIcon className="size-4 mr-1.5 text-primary" /> Vincular Existente
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                const r = await create({ data: { type: "prova", room_id: room.id } });
                nav({ to: "/admin/avaliacoes/$id", params: { id: r.id } });
              }}
            >
              <Plus className="size-4 mr-1.5" /> Criar Nova
            </Button>
          </div>
        </div>

        <ul className="paper-card divide-y">
          {data.assessments.map((a) => (
            <li key={a.id} className="px-4 py-3.5 flex flex-wrap items-center justify-between gap-3 hover:bg-muted/10 transition">
              <div className="min-w-0">
                <Link to="/admin/avaliacoes/$id" params={{ id: a.id }} className="font-semibold hover:underline block truncate">
                  {a.title}
                </Link>
                <span className="text-xs text-muted-foreground">{TYPE_LABEL[a.type] ?? a.type}</span>
              </div>

              <div className="flex items-center gap-3">
                <StatusPill status={a.status} />
                <Button asChild variant="ghost" size="sm" className="h-8 text-xs">
                  <Link to="/admin/analise/$id" params={{ id: a.id }}>
                    Resultados
                  </Link>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground hover:text-destructive"
                  onClick={() => handleUnlinkAssessment(a.id)}
                  title="Desvincular desta sala (a avaliação continuará no acervo)"
                >
                  <Unlink className="size-4" />
                </Button>
              </div>
            </li>
          ))}

          {!data.assessments.length && (
            <li className="px-4 py-8 text-center text-muted-foreground text-sm">
              <p>Nenhuma avaliação vinculada a esta sala.</p>
              <p className="text-xs mt-1">Clique em "Vincular Existente" para adicionar uma prova do seu acervo ou crie uma nova.</p>
            </li>
          )}
        </ul>
      </section>

      {/* Link Existing Assessment Modal */}
      <Dialog open={linkModalOpen} onOpenChange={setLinkModalOpen}>
        <DialogContent className="max-w-xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <Library className="size-5 text-primary" /> Vincular Avaliação a {room.name}
            </DialogTitle>
            <DialogDescription>
              Selecione uma avaliação do seu acervo. Você pode vinculá-la diretamente ou criar uma cópia independente para esta sala.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 my-3">
            {unlinkedAssessments.map((a) => (
              <div
                key={a.id}
                className="p-3.5 rounded-xl border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/20"
              >
                <div>
                  <p className="font-semibold text-sm">{a.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {TYPE_LABEL[a.type]} · {a.questions} questões {a.room ? `· (Na sala ${a.room.name})` : "· (Template livre)"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                    onClick={() => handleLinkExisting(a.id, true)}
                    title="Clona a avaliação como uma nova instância exclusiva para esta sala"
                  >
                    <Copy className="size-3.5 mr-1" /> Clonar para Cá
                  </Button>
                  {!a.room_id && (
                    <Button
                      size="sm"
                      variant="chalk"
                      className="h-8 text-xs"
                      onClick={() => handleLinkExisting(a.id, false)}
                    >
                      <LinkIcon className="size-3.5 mr-1" /> Vincular
                    </Button>
                  )}
                </div>
              </div>
            ))}

            {!unlinkedAssessments.length && (
              <p className="p-8 text-center text-muted-foreground text-sm">
                Todas as avaliações já estão vinculadas ou nenhuma foi criada ainda.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
