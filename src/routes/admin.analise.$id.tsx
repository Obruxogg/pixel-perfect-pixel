import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/AdminShell";

export const Route = createFileRoute("/admin/analise/$id")({
  head: () => ({ meta: [{ title: "Análise da avaliação — giz." }, { name: "description", content: "Análise da avaliação" }, { property: "og:title", content: "Análise da avaliação — giz." }, { property: "og:description", content: "Análise da avaliação" }] }),
  component: () => (
    <div>
      <PageHeader title="Análise da avaliação" subtitle="Esta tela ainda será concluída." />
    </div>
  ),
});
