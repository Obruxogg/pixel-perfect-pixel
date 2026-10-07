import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { generateDemoData, clearAllData } from "@/lib/admin.functions";
import { PageHeader } from "@/components/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sparkles, Trash2, ShieldCheck, Database, Save, Info } from "lucide-react";

export const Route = createFileRoute("/admin/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações — giz." },
      { name: "description", content: "Configurações gerais do sistema e gerador de dados de demonstração." },
      { property: "og:title", content: "Configurações — giz." },
      { property: "og:description", content: "Configurações gerais do sistema e gerador de dados de demonstração." },
    ],
  }),
  component: SettingsPage,
});

const SETTINGS_KEY = "giz:settings";

function SettingsPage() {
  const seedFn = useServerFn(generateDemoData);
  const clearFn = useServerFn(clearAllData);
  const qc = useQueryClient();
  const nav = useNavigate();

  const [teacherName, setTeacherName] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [defaultPassingScore, setDefaultPassingScore] = useState("6.0");
  const [isSeeding, setIsSeeding] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) {
      try {
        const json = JSON.parse(saved);
        setTeacherName(json.teacherName || "");
        setSchoolName(json.schoolName || "");
        setDefaultPassingScore(json.defaultPassingScore || "6.0");
      } catch {
        // ignore
      }
    }
  }, []);

  function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({
        teacherName,
        schoolName,
        defaultPassingScore,
      }),
    );
    toast.success("Configurações salvas com sucesso!");
  }

  async function handleGenerateDemo() {
    if (
      !confirm(
        "Deseja gerar dados de demonstração completos (Salas INFO26, EXCEL7, Prova de Excel, Questionário, alunos e respostas)?",
      )
    )
      return;

    setIsSeeding(true);
    try {
      await seedFn();
      qc.invalidateQueries();
      toast.success("Dados de demonstração criados com sucesso!");
      nav({ to: "/admin" });
    } catch {
      toast.error("Erro ao gerar dados de demonstração.");
    } finally {
      setIsSeeding(false);
    }
  }

  async function handleClearAll() {
    if (
      !confirm(
        "ATENÇÃO: Deseja realmente APAGAR todas as salas, avaliações, participantes e notas para reiniciar o banco do zero?",
      )
    )
      return;

    setIsClearing(true);
    try {
      await clearFn();
      qc.invalidateQueries();
      toast.success("Banco de dados reiniciado.");
      nav({ to: "/admin" });
    } catch {
      toast.error("Erro ao limpar dados.");
    } finally {
      setIsClearing(false);
    }
  }

  return (
    <div className="max-w-4xl pb-16 space-y-8">
      <PageHeader
        title="Configurações"
        subtitle="Personalize preferências gerais e gerencie o armazenamento da aplicação."
      />

      {/* Teacher / School Preferences */}
      <form onSubmit={handleSaveProfile} className="paper-card p-6 space-y-5">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <ShieldCheck className="size-5 text-primary" /> Preferências do Professor
        </h2>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Nome do Professor / Instrutor</Label>
            <Input
              value={teacherName}
              onChange={(e) => setTeacherName(e.target.value)}
              placeholder="Ex: Prof. Carlos Eduardo"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Instituição / Escola</Label>
            <Input
              value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)}
              placeholder="Ex: Escola Técnica de Tecnologia"
            />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Média Mínima Padrão (0 a 10)</Label>
            <Input
              type="number"
              min="0"
              max="10"
              step="0.5"
              value={defaultPassingScore}
              onChange={(e) => setDefaultPassingScore(e.target.value)}
            />
          </div>
        </div>

        <Button type="submit" variant="chalk">
          <Save className="size-4 mr-1.5" /> Salvar Preferências
        </Button>
      </form>

      {/* Demo Data & Database Management */}
      <div className="paper-card p-6 space-y-5">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Database className="size-5 text-primary" /> Gerenciamento de Dados
        </h2>

        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-muted/40 border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="font-bold">Gerar Dados de Demonstração</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Cria automaticamente as salas <b>INFO26</b>, <b>EXCEL7</b> e <b>WORD3</b> com avaliações, questionários, alunos
                e respostas para testes imediatos.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={handleGenerateDemo}
              disabled={isSeeding}
              className="shrink-0"
            >
              <Sparkles className="size-4 mr-1.5 text-accent" />
              {isSeeding ? "Gerando…" : "Gerar Demonstração"}
            </Button>
          </div>

          <div className="p-4 rounded-xl bg-destructive/5 border border-destructive/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="font-bold text-destructive">Limpar Todo o Banco de Dados</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Remove todas as salas, avaliações, alunos e respostas salvas no sistema.
              </p>
            </div>
            <Button
              type="button"
              variant="destructive"
              onClick={handleClearAll}
              disabled={isClearing}
              className="shrink-0"
            >
              <Trash2 className="size-4 mr-1.5" />
              {isClearing ? "Limpando…" : "Limpar Tudo"}
            </Button>
          </div>
        </div>
      </div>

      {/* Architecture Info */}
      <div className="p-5 rounded-2xl bg-muted/30 border text-xs text-muted-foreground space-y-2">
        <div className="flex items-center gap-2 text-foreground font-semibold">
          <Info className="size-4 text-primary" /> Arquitetura Sem Senhas & Direcionada para Sala de Aula
        </div>
        <p>
          O sistema <b>giz.</b> foi concebido para uso prático direto pelo professor. Os alunos não necessitam de contas,
          senhas ou e-mails — apenas informam nome e turma ao acessar a sala pelo código ou QR Code.
        </p>
        <p>
          O painel administrativo abre diretamente sem atritos, permitindo projetar a sala e acompanhar os envios em tempo
          real no <b>Modo Aula</b>.
        </p>
      </div>
    </div>
  );
}
