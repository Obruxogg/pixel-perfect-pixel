import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/AdminShell";

export const Route = createFileRoute("/admin/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações — giz." }, { name: "description", content: "Configurações" }, { property: "og:title", content: "Configurações — giz." }, { property: "og:description", content: "Configurações" }] }),
  component: () => (
    <div>
      <PageHeader title="Configurações" subtitle="Esta tela ainda será concluída." />
    </div>
  ),
});
