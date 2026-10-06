import { Link, Outlet } from "@tanstack/react-router";
import { LayoutDashboard, DoorOpen, ClipboardList, Library, BarChart3, FileText, Settings } from "lucide-react";

const NAV = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/salas", label: "Salas", icon: DoorOpen },
  { to: "/admin/avaliacoes", label: "Avaliações", icon: ClipboardList },
  { to: "/admin/banco", label: "Banco de Questões", icon: Library },
  { to: "/admin/resultados", label: "Resultados", icon: BarChart3 },
  { to: "/admin/relatorios", label: "Relatórios", icon: FileText },
  { to: "/admin/configuracoes", label: "Configurações", icon: Settings },
] as const;

export function AdminShell() {
  return (
    <div className="min-h-screen md:flex">
      <aside className="chalk-texture text-board-foreground md:w-60 md:min-h-screen md:sticky md:top-0 shrink-0">
        <div className="px-5 py-5 flex items-center justify-between md:block">
          <Link to="/admin" className="font-display text-2xl font-bold tracking-tight">giz<span className="text-accent">.</span></Link>
          <p className="hidden md:block text-xs text-board-muted mt-1">Aplicação de avaliações</p>
        </div>
        <nav className="flex md:flex-col gap-1 px-3 pb-3 overflow-x-auto">
          {NAV.map((n) => (
            <Link key={n.to} to={n.to} activeOptions={{ exact: "exact" in n }}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm whitespace-nowrap text-board-muted hover:text-board-foreground hover:bg-board-foreground/5"
              activeProps={{ className: "!bg-accent !text-accent-foreground font-semibold" }}>
              <n.icon className="size-4" /> {n.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="flex-1 min-w-0 px-4 py-6 md:px-10 md:py-8">
        <Outlet />
      </main>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div>
        <h1 className="text-3xl font-bold">{title}</h1>
        {subtitle && <p className="text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    ativa: "bg-success text-success-foreground", disponivel: "bg-success text-success-foreground",
    rascunho: "bg-muted text-muted-foreground", encerrada: "bg-secondary text-secondary-foreground border border-border",
    arquivada: "bg-muted text-muted-foreground", concluida: "bg-success text-success-foreground",
    em_andamento: "bg-accent text-accent-foreground", nao_iniciada: "bg-muted text-muted-foreground",
  };
  const label: Record<string, string> = {
    ativa: "Ativa", disponivel: "Disponível", rascunho: "Rascunho", encerrada: "Encerrada", arquivada: "Arquivada",
    concluida: "Concluída", em_andamento: "Em andamento", nao_iniciada: "Não iniciada",
  };
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${map[status] ?? "bg-muted"}`}>{label[status] ?? status}</span>;
}

export const fmtTime = (iso?: string | null) => (iso ? new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—");
export const fmtDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "—");
