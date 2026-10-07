import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/AdminShell";

export const Route = createFileRoute("/admin/relatorios")({
  head: () => ({ meta: [{ title: "Relatórios — giz." }, { name: "description", content: "Relatórios" }, { property: "og:title", content: "Relatórios — giz." }, { property: "og:description", content: "Relatórios" }] }),
  component: () => (
    <div>
      <PageHeader title="Relatórios" subtitle="Esta tela ainda será concluída." />
    </div>
  ),
});
