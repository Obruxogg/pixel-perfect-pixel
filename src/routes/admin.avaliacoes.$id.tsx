import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/AdminShell";

export const Route = createFileRoute("/admin/avaliacoes/$id")({
  head: () => ({ meta: [{ title: "Editor de avaliação — giz." }, { name: "description", content: "Editor de avaliação" }, { property: "og:title", content: "Editor de avaliação — giz." }, { property: "og:description", content: "Editor de avaliação" }] }),
  component: () => (
    <div>
      <PageHeader title="Editor de avaliação" subtitle="Esta tela ainda será concluída." />
    </div>
  ),
});
