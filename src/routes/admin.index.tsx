import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { getDashboard, createAssessment } from "@/lib/admin.functions";
import { PageHeader, fmtTime } from "@/components/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus } from "lucide-react";

export const Route = createFileRoute("/admin/")({
  head: () => ({ meta: [{ title: "Dashboard — giz." }, { name: "description", content: "Visão geral das salas e avaliações." }, { property: "og:title", content: "Dashboard — giz." }, { property: "og:description", content: "Visão geral das salas e avaliações." }] }),
  component: Dashboard,
});

function Dashboard() {
  const fn = useServerFn(getDashboard);
  const { data } = useQuery({ queryKey: ["dashboard"], queryFn: () => fn(), refetchInterval: 10000 });
  const create = useServerFn(createAssessment);
  const nav = useNavigate();
  const [open, setOpen] = useState("");

  async function newA(type: "prova" | "atividade" | "questionario" | "diagnostico") {
    const r = await create({ data: { type } });
    nav({ to: "/admin/avaliacoes/$id", params: { id: r.id } });
  }

  const s = data?.stats;
  const cards = s ? [
    ["Salas ativas", s.salasAtivas], ["Avaliações ativas", s.avaliacoesAtivas], ["Respondendo agora", s.respondendoAgora], ["Respostas hoje", s.respostasHoje],
    ["Provas concluídas", s.provasConcluidas], ["Média geral", s.mediaGeral ?? "—"], ["Abaixo da média", s.abaixoDaMedia], ["Questionários respondidos", s.questionariosRespondidos],
  ] : [];

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="O que está acontecendo nas suas salas." actions={<>
        <form onSubmit={(e) => { e.preventDefault(); const r = data?.activeRooms.find((x) => x.code === open.trim().toUpperCase()); if (r) nav({ to: "/admin/salas/$id", params: { id: r.id } }); else nav({ to: "/admin/salas" }); }} className="flex gap-2">
          <Input value={open} onChange={(e) => setOpen(e.target.value)} placeholder="Código" className="w-28 font-mono uppercase" />
          <Button variant="outline" type="submit">Abrir sala</Button>
        </form>
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button variant="chalk"><Plus /> Criar</Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => nav({ to: "/admin/salas", search: { nova: true } })}>Nova sala</DropdownMenuItem>
            <DropdownMenuItem onClick={() => newA("prova")}>Nova prova</DropdownMenuItem>
            <DropdownMenuItem onClick={() => newA("atividade")}>Nova atividade</DropdownMenuItem>
            <DropdownMenuItem onClick={() => newA("questionario")}>Novo questionário</DropdownMenuItem>
            <DropdownMenuItem onClick={() => newA("diagnostico")}>Nova avaliação diagnóstica</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </>} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map(([l, v]) => (
          <div key={l as string} className="paper-card p-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">{l}</p>
            <p className="font-display text-3xl font-extrabold mt-1">{v}</p>
          </div>
        ))}
        {!s && <p className="text-muted-foreground col-span-4">Carregando…</p>}
      </div>

      <div className="grid lg:grid-cols-3 gap-6 mt-8">
        <section className="lg:col-span-2">
          <h2 className="text-xl font-bold mb-3">Salas ativas</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {data?.activeRooms.map((r) => (
              <Link key={r.id} to="/admin/salas/$id" params={{ id: r.id }} className="chalk-texture text-board-foreground rounded-xl p-5 hover:ring-2 hover:ring-accent transition">
                <p className="font-bold text-lg">{r.name}</p>
                <p className="font-mono text-accent font-extrabold tracking-widest mt-1">{r.code}</p>
                <p className="text-sm text-board-muted mt-3">{r.participants} participantes · {r.assessments} avaliações</p>
              </Link>
            ))}
            {data && !data.activeRooms.length && <p className="text-muted-foreground">Nenhuma sala ativa.</p>}
          </div>
        </section>
        <section>
          <h2 className="text-xl font-bold mb-3">Atividade recente</h2>
          <ul className="paper-card divide-y">
            {data?.recent.map((r) => (
              <li key={r.id} className="px-4 py-3 text-sm">
                <Link to="/admin/resultados/$id" params={{ id: r.id }} className="block">
                  <span className="font-semibold">{r.name}</span> {r.status === "concluida" ? "concluiu" : "iniciou"} <span className="text-muted-foreground">{r.title}</span>
                  <span className="float-right font-mono text-xs text-muted-foreground">{r.nota != null ? `${r.nota} · ` : ""}{fmtTime(r.at)}</span>
                </Link>
              </li>
            ))}
            {data && !data.recent.length && <li className="px-4 py-3 text-sm text-muted-foreground">Sem atividade ainda.</li>}
          </ul>
        </section>
      </div>
    </div>
  );
}
