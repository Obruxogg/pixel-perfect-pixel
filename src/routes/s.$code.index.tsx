import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { findRoom, joinRoom, getStudentRoom } from "@/lib/student.functions";
import { TYPE_LABEL } from "@/lib/grading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/s/$code/")({
  head: ({ params }) => ({
    meta: [
      { title: `Sala ${params.code} — giz.` },
      { name: "description", content: "Informe seu nome e turma para entrar na sala." },
      { property: "og:title", content: `Sala ${params.code} — giz.` },
      { property: "og:description", content: "Informe seu nome e turma para entrar na sala." },
    ],
  }),
  component: RoomPage,
});

export const pKey = (code: string) => `giz:p:${code.toUpperCase()}`;

type RoomData = Extract<Awaited<ReturnType<typeof getStudentRoom>>, { ok: true }>;

function RoomPage() {
  const { code } = Route.useParams();
  const [stage, setStage] = useState<"loading" | "join" | "room" | "error">("loading");
  const [error, setError] = useState("");
  const [roomName, setRoomName] = useState("");
  const [data, setData] = useState<RoomData | null>(null);
  const find = useServerFn(findRoom);
  const load = useServerFn(getStudentRoom);

  async function loadRoom(pid: string) {
    const r = await load({ data: { participantId: pid } });
    if (r.ok) { setData(r); setStage("room"); return true; }
    return false;
  }

  useEffect(() => {
    (async () => {
      const pid = localStorage.getItem(pKey(code));
      if (pid && (await loadRoom(pid))) return;
      localStorage.removeItem(pKey(code));
      const r = await find({ data: { code } });
      if (!r.ok) { setError(r.error); setStage("error"); return; }
      setRoomName(r.room.name); setStage("join");
    })().catch(() => { setError("Não foi possível carregar a sala."); setStage("error"); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  return (
    <div className="min-h-screen bg-background">
      <header className="chalk-texture text-board-foreground px-5 py-4 flex items-center justify-between">
        <Link to="/" className="font-display font-bold">giz<span className="text-accent">.</span></Link>
        <span className="font-mono font-extrabold tracking-widest">{code}</span>
      </header>
      <div className="max-w-lg mx-auto px-5 py-10">
        {stage === "loading" && <p className="text-muted-foreground">Carregando…</p>}
        {stage === "error" && (
          <div className="paper-card p-8 text-center">
            <p className="text-lg font-semibold">{error}</p>
            <Button asChild variant="outline" className="mt-6"><Link to="/">Tentar outro código</Link></Button>
          </div>
        )}
        {stage === "join" && <JoinForm code={code} roomName={roomName} onJoined={async (pid) => { localStorage.setItem(pKey(code), pid); await loadRoom(pid); }} />}
        {stage === "room" && data && <RoomList code={code} data={data} onLeave={() => { localStorage.removeItem(pKey(code)); location.reload(); }} />}
      </div>
    </div>
  );
}

function JoinForm({ code, roomName, onJoined }: { code: string; roomName: string; onJoined: (pid: string) => Promise<void> }) {
  const [name, setName] = useState("");
  const [cls, setCls] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const join = useServerFn(joinRoom);
  const [today, setToday] = useState("");
  useEffect(() => setToday(new Date().toLocaleDateString("pt-BR")), []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim().length < 3) return setErr("Informe seu nome completo.");
    if (!cls.trim()) return setErr("Informe a turma.");
    setBusy(true); setErr("");
    try {
      const r = await join({ data: { code, name: name.trim(), className: cls.trim() } });
      if (!r.ok) setErr(r.error); else await onJoined(r.participantId);
    } catch { setErr("Não foi possível entrar. Tente novamente."); }
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="paper-card p-6 md:p-8 space-y-5">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Sala</p>
        <h1 className="text-2xl font-bold">{roomName}</h1>
      </div>
      <div className="space-y-2"><Label htmlFor="n">Nome completo</Label><Input id="n" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} autoFocus className="h-12 text-base" /></div>
      <div className="space-y-2"><Label htmlFor="t">Turma</Label><Input id="t" value={cls} onChange={(e) => setCls(e.target.value)} maxLength={60} className="h-12 text-base" /></div>
      <div className="space-y-2"><Label>Data</Label><Input value={today} readOnly className="h-12 text-base bg-muted" /></div>
      {err && <p role="alert" className="text-destructive font-semibold">{err}</p>}
      <Button type="submit" variant="chalk" disabled={busy} className="w-full h-12 text-base">{busy ? "Entrando…" : "Continuar"}</Button>
    </form>
  );
}

function RoomList({ code, data, onLeave }: { code: string; data: RoomData; onLeave: () => void }) {
  const nav = useNavigate();
  const first = data.participant.name.split(" ")[0];
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Sala — {data.room.name}</p>
      <h1 className="text-3xl font-bold mt-1">Olá, {first}.</h1>
      <p className="text-muted-foreground mt-1">Atividades disponíveis:</p>
      <ul className="mt-6 space-y-3">
        {data.assessments.length === 0 && <li className="paper-card p-6 text-muted-foreground">Nenhuma atividade disponível ainda. Aguarde o professor.</li>}
        {data.assessments.map((a) => (
          <li key={a.id} className="paper-card p-5 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">{TYPE_LABEL[a.type]}</p>
              <p className="font-semibold">{a.title}</p>
            </div>
            {a.status === "encerrada" ? <span className="text-sm text-muted-foreground font-semibold">Encerrada</span>
              : !a.canStart ? <span className="text-sm text-success font-semibold">Respondida ✓</span>
              : <Button variant="chalk" onClick={() => nav({ to: "/s/$code/a/$assessmentId", params: { code, assessmentId: a.id } })}>
                  {a.type === "questionario" ? "Responder" : a.completed ? "Nova tentativa" : "Iniciar"}
                </Button>}
          </li>
        ))}
      </ul>
      <button onClick={onLeave} className="mt-10 text-sm text-muted-foreground underline">Não é {first}? Trocar identificação</button>
    </div>
  );
}
