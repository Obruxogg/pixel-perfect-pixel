import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { listRooms, createRoom, suggestCode } from "@/lib/admin.functions";
import { PageHeader, StatusPill } from "@/components/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Wand2 } from "lucide-react";

export const Route = createFileRoute("/admin/salas/")({
  validateSearch: z.object({ nova: z.boolean().optional() }),
  head: () => ({ meta: [{ title: "Salas — giz." }, { name: "description", content: "Gerencie as salas e seus códigos." }, { property: "og:title", content: "Salas — giz." }, { property: "og:description", content: "Gerencie as salas e seus códigos." }] }),
  component: Rooms,
});

function Rooms() {
  const { nova } = Route.useSearch();
  const fn = useServerFn(listRooms);
  const { data } = useQuery({ queryKey: ["rooms"], queryFn: () => fn() });
  const [open, setOpen] = useState(!!nova);
  const [q, setQ] = useState("");
  const list = (data ?? []).filter((r) => `${r.name} ${r.code} ${r.class_name}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div>
      <PageHeader title="Salas" subtitle="Cada sala tem um código para os alunos entrarem." actions={<Button variant="chalk" onClick={() => setOpen(true)}><Plus /> Nova sala</Button>} />
      <Input placeholder="Buscar sala…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs mb-4" />
      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {list.map((r) => (
          <Link key={r.id} to="/admin/salas/$id" params={{ id: r.id }} className="paper-card p-5 hover:ring-2 hover:ring-accent transition">
            <div className="flex justify-between items-start gap-2"><p className="font-bold text-lg">{r.name}</p><StatusPill status={r.status} /></div>
            <p className="font-mono font-extrabold tracking-widest text-xl mt-2">{r.code}</p>
            <p className="text-sm text-muted-foreground mt-2">{r.class_name || "—"} · {r.participants} participantes · {r.assessments} avaliações</p>
          </Link>
        ))}
        {data && !list.length && <p className="text-muted-foreground">Nenhuma sala encontrada.</p>}
      </div>
      <NewRoomDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}

function NewRoomDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (b: boolean) => void }) {
  const [f, setF] = useState({ name: "", class_name: "", description: "", code: "" });
  const [busy, setBusy] = useState(false);
  const create = useServerFn(createRoom);
  const suggest = useServerFn(suggestCode);
  const qc = useQueryClient();
  const nav = useNavigate();
  useEffect(() => { if (open) setF({ name: "", class_name: "", description: "", code: "" }); }, [open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.name.trim()) return toast.error("Informe o nome da sala.");
    setBusy(true);
    const r = await create({ data: { ...f, code: f.code || undefined } }).catch((er) => ({ ok: false as const, error: String(er?.message ?? er) }));
    setBusy(false);
    if (!r.ok) return toast.error(r.error);
    qc.invalidateQueries({ queryKey: ["rooms"] });
    onOpenChange(false);
    nav({ to: "/admin/salas/$id", params: { id: r.id } });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Nova sala</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5"><Label>Nome da sala</Label><Input value={f.name} maxLength={100} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Informática — Terça-feira" /></div>
          <div className="space-y-1.5"><Label>Turma</Label><Input value={f.class_name} maxLength={60} onChange={(e) => setF({ ...f, class_name: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Descrição (opcional)</Label><Textarea value={f.description} maxLength={500} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
          <div className="space-y-1.5">
            <Label>Código da sala</Label>
            <div className="flex gap-2">
              <Input value={f.code} maxLength={12} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") })} placeholder="Deixe vazio para gerar" className="font-mono" />
              <Button type="button" variant="outline" onClick={async () => setF({ ...f, code: await suggest() })}><Wand2 /> Gerar</Button>
            </div>
          </div>
          <Button type="submit" variant="chalk" disabled={busy} className="w-full">{busy ? "Criando…" : "Criar sala"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
