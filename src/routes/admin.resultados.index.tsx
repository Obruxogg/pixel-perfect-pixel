import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/AdminShell";

export const Route = createFileRoute("/admin/resultados/")({
  head: () => ({ meta: [{ title: "Resultados — giz." }, { name: "description", content: "Resultados" }, { property: "og:title", content: "Resultados — giz." }, { property: "og:description", content: "Resultados" }] }),
  component: () => (
    <div>
      <PageHeader title="Resultados" subtitle="Esta tela ainda será concluída." />
    </div>
  ),
});
