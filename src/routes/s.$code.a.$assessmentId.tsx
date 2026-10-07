import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { startAssessment, submitAssessment } from "@/lib/student.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/s/$code/a/$assessmentId")({
  head: () => ({
    meta: [
      { title: "Responder avaliação — giz." },
      { name: "description", content: "Responda às questões e envie ao professor." },
      { property: "og:title", content: "Responder avaliação — giz." },
      { property: "og:description", content: "Responda às questões e envie ao professor." },
    ],
  }),
  component: Take,
});

type Started = Extract<Awaited<ReturnType<typeof startAssessment>>, { ok: true }>;
type Val = string | number | string[] | null;

function Take() {
  const { code, assessmentId } = Route.useParams();
  const start = useServerFn(startAssessment);
  const submit = useServerFn(submitAssessment);
  const nav = useNavigate();
  const [data, setData] = useState<Started | null>(null);
  const [error, setError] = useState("");
  const [answers, setAnswers] = useState<Record<string, Val>>({});
  const [review, setReview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const pid = localStorage.getItem(`giz:p:${code.toUpperCase()}`);
    if (!pid) { nav({ to: "/s/$code", params: { code } }); return; }
    start({ data: { participantId: pid, assessmentId } })
      .then((r) => (r.ok ? setData(r) : setError(r.error)))
      .catch(() => setError("Não foi possível abrir a avaliação."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, assessmentId]);

  const set = (id: string, v: Val) => setAnswers((a) => ({ ...a, [id]: v }));
  const answered = data ? data.questions.filter((q) => { const v = answers[q.id]; return v != null && v !== "" && !(Array.isArray(v) && !v.length); }).length : 0;

  async function send() {
    if (!data) return;
    setBusy(true);
    try {
      const r = await submit({ data: { submissionId: data.submissionId, answers } });
      if (!r.ok) setError(r.error); else setDone(true);
    } catch { setError("Falha ao enviar. Verifique a conexão e tente de novo."); }
    setBusy(false);
  }

  const back = <Button asChild variant="outline" className="mt-6"><Link to="/s/$code" params={{ code }}>Voltar à sala</Link></Button>;

  return (
    <div className="min-h-screen bg-background">
      <header className="chalk-texture text-board-foreground px-5 py-4 flex items-center justify-between sticky top-0 z-10">
        <span className="font-semibold truncate">{data?.assessment.title ?? "Avaliação"}</span>
        {data && !done && <span className="font-mono text-sm">{answered}/{data.questions.length}</span>}
      </header>
      <div className="max-w-2xl mx-auto px-5 py-8">
        {done ? (
          <div className="paper-card p-10 text-center">
            <p className="text-5xl">✓</p>
            <h1 className="text-2xl font-bold mt-4">Respostas enviadas!</h1>
            <p className="text-muted-foreground mt-2">Obrigado. Seu professor já recebeu.</p>
            {back}
          </div>
        ) : error ? (
          <div className="paper-card p-8 text-center"><p className="text-lg font-semibold">{error}</p>{back}</div>
        ) : !data ? <p className="text-muted-foreground">Carregando…</p> : (
          <div className="space-y-5">
            {data.assessment.description && <p className="text-muted-foreground">{data.assessment.description}</p>}
            {data.questions.map((q, i) => (
              <section key={q.id} className="paper-card p-5 md:p-6">
                <p className="text-xs font-mono text-muted-foreground">QUESTÃO {i + 1}{Number(q.points) > 0 ? ` · ${q.points} pt` : ""}</p>
                <p className="font-semibold text-lg mt-1 whitespace-pre-wrap">{q.prompt}</p>
                <div className="mt-4">
                  {(q.type === "unica" || q.type === "vf") && q.options.map((o) => (
                    <label key={o.id} className={`flex items-center gap-3 rounded-lg border-2 px-4 py-3 mb-2 cursor-pointer ${answers[q.id] === o.id ? "border-accent bg-accent/10" : "border-border"}`}>
                      <input type="radio" name={q.id} checked={answers[q.id] === o.id} onChange={() => set(q.id, o.id)} disabled={review} className="accent-primary size-4" />
                      {o.text}
                    </label>
                  ))}
                  {q.type === "multipla" && q.options.map((o) => {
                    const cur = (answers[q.id] as string[] | undefined) ?? [];
                    const on = cur.includes(o.id);
                    return (
                      <label key={o.id} className={`flex items-center gap-3 rounded-lg border-2 px-4 py-3 mb-2 cursor-pointer ${on ? "border-accent bg-accent/10" : "border-border"}`}>
                        <input type="checkbox" checked={on} disabled={review} onChange={() => set(q.id, on ? cur.filter((x) => x !== o.id) : [...cur, o.id])} className="accent-primary size-4" />
                        {o.text}
                      </label>
                    );
                  })}
                  {q.type === "curta" && <Input value={(answers[q.id] as string) ?? ""} disabled={review} maxLength={300} onChange={(e) => set(q.id, e.target.value)} className="h-12" />}
                  {q.type === "longa" && <Textarea value={(answers[q.id] as string) ?? ""} disabled={review} maxLength={5000} rows={5} onChange={(e) => set(q.id, e.target.value)} />}
                  {q.type === "escala" && (
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button key={n} type="button" disabled={review} onClick={() => set(q.id, String(n))}
                          className={`size-12 rounded-lg border-2 font-mono font-bold ${answers[q.id] === String(n) ? "border-accent bg-accent text-accent-foreground" : "border-border"}`}>{n}</button>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            ))}
            <div className="sticky bottom-0 bg-background/95 backdrop-blur py-4 border-t">
              {!review ? (
                <Button variant="chalk" className="w-full h-12 text-base" onClick={() => setReview(true)}>Revisar respostas</Button>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-center">{answered} de {data.questions.length} respondidas{answered < data.questions.length ? " — há questões em branco." : "."}</p>
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1 h-12" onClick={() => setReview(false)}>Editar</Button>
                    <Button variant="chalk" className="flex-1 h-12 text-base" disabled={busy} onClick={send}>{busy ? "Enviando…" : "Finalizar e enviar"}</Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
