import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/AdminShell";

export const Route = createFileRoute("/admin/avaliacoes/")({
  head: () => ({ meta: [{ title: "Avaliações — giz." }, { name: "description", content: "Avaliações" }, { property: "og:title", content: "Avaliações — giz." }, { property: "og:description", content: "Avaliações" }] }),
  component: () => (
    <div>
      <PageHeader title="Avaliações" subtitle="Esta tela ainda será concluída." />
    </div>
  ),
});
