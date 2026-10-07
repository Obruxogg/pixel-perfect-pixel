import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/AdminShell";

export const Route = createFileRoute("/admin/banco")({
  head: () => ({ meta: [{ title: "Banco de Questões — giz." }, { name: "description", content: "Banco de Questões" }, { property: "og:title", content: "Banco de Questões — giz." }, { property: "og:description", content: "Banco de Questões" }] }),
  component: () => (
    <div>
      <PageHeader title="Banco de Questões" subtitle="Esta tela ainda será concluída." />
    </div>
  ),
});
