import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { findRoom } from "@/lib/student.functions";
import { normalizeCode } from "@/lib/grading";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Entrar em uma sala — giz." },
      { name: "description", content: "Digite o código da sala informado pelo professor para responder às avaliações." },
      { property: "og:title", content: "Entrar em uma sala — giz." },
      { property: "og:description", content: "Digite o código da sala e comece a responder." },
    ],
  }),
  component: Enter,
});

function Enter() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const find = useServerFn(findRoom);
  const nav = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const c = normalizeCode(code);
    if (!c) return setError("Digite o código da sala.");
    setBusy(true); setError("");
    const r = await find({ data: { code: c } }).catch(() => ({ ok: false as const, error: "Não foi possível verificar. Tente novamente." }));
    setBusy(false);
    if (!r.ok) return setError(r.error);
    nav({ to: "/s/$code", params: { code: c } });
  }

  return (
    <div className="chalk-texture min-h-screen flex flex-col items-center justify-center px-5 text-board-foreground">
      <form onSubmit={submit} className="w-full max-w-md text-center">
        <p className="font-display text-xl font-bold mb-10">giz<span className="text-accent">.</span></p>
        <h1 className="text-4xl md:text-5xl font-extrabold">Entrar em uma sala</h1>
        <label htmlFor="code" className="block mt-10 mb-3 text-sm uppercase tracking-[0.2em] text-board-muted">Código da sala</label>
        <input id="code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} autoFocus autoComplete="off" maxLength={20}
          placeholder="EXCEL26"
          className="w-full rounded-xl bg-board-foreground/10 border-2 border-board-foreground/20 focus:border-accent outline-none text-center font-mono text-4xl font-extrabold tracking-[0.15em] py-4 placeholder:text-board-foreground/25" />
        {error && <p role="alert" className="mt-4 text-accent font-semibold">{error}</p>}
        <Button type="submit" variant="chalk" disabled={busy} className="w-full mt-6 h-14 text-lg">{busy ? "Verificando…" : "Entrar"}</Button>
      </form>
    </div>
  );
}
