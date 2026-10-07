import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/AdminShell";

export const Route = createFileRoute("/admin/resultados/$id")({
  head: () => ({ meta: [{ title: "Resposta do aluno — giz." }, { name: "description", content: "Resposta do aluno" }, { property: "og:title", content: "Resposta do aluno — giz." }, { property: "og:description", content: "Resposta do aluno" }] }),
  component: () => (
    <div>
      <PageHeader title="Resposta do aluno" subtitle="Esta tela ainda será concluída." />
    </div>
  ),
});
