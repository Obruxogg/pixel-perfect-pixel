// Teacher-side functions. Access is intentionally open (internal tool, no login per spec).
// To add admin auth later, add a middleware to these functions in one place.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { normalizeCode, randomCode, toTen } from "./grading";

const db = async () => (await import("@/integrations/supabase/client.server")).supabaseAdmin;
const uuid = z.string().uuid();

export const getDashboard = createServerFn({ method: "GET" }).handler(async () => {
  const s = await db();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const [rooms, assessments, subs] = await Promise.all([
    s.from("rooms").select("id,name,code,status"),
    s.from("assessments").select("id,title,type,status,room_id,passing_score"),
    s.from("submissions").select("id,status,score,max_score,started_at,submitted_at,assessment_id,participants(name,class_name)").order("started_at", { ascending: false }).limit(2000),
  ]);
  const { data: parts } = await s.from("participants").select("room_id");
  const A = assessments.data ?? [], S = subs.data ?? [], R = rooms.data ?? [];
  const graded = S.filter((x) => x.status === "concluida" && x.max_score);
  const notes = graded.map((x) => ({ n: toTen(x.score, x.max_score)!, pass: Number(A.find((a) => a.id === x.assessment_id)?.passing_score ?? 6) }));
  const activeRooms = R.filter((r) => r.status === "ativa").map((r) => ({
    ...r,
    participants: (parts ?? []).filter((p) => p.room_id === r.id).length,
    assessments: A.filter((a) => a.room_id === r.id).length,
  }));
  return {
    activeRooms,
    stats: {
      salasAtivas: activeRooms.length,
      avaliacoesAtivas: A.filter((a) => a.status === "disponivel").length,
      respondendoAgora: S.filter((x) => x.status === "em_andamento").length,
      respostasHoje: S.filter((x) => x.submitted_at && new Date(x.submitted_at) >= today).length,
      provasConcluidas: S.filter((x) => x.status === "concluida" && A.find((a) => a.id === x.assessment_id)?.type !== "questionario").length,
      mediaGeral: notes.length ? Math.round((notes.reduce((t, x) => t + x.n, 0) / notes.length) * 10) / 10 : null,
      abaixoDaMedia: notes.filter((x) => x.n < x.pass).length,
      questionariosRespondidos: S.filter((x) => x.status === "concluida" && A.find((a) => a.id === x.assessment_id)?.type === "questionario").length,
    },
    recent: S.slice(0, 8).map((x) => ({
      id: x.id, status: x.status, at: x.submitted_at ?? x.started_at,
      name: (x.participants as { name: string } | null)?.name ?? "—",
      title: A.find((a) => a.id === x.assessment_id)?.title ?? "—",
      nota: toTen(x.score, x.max_score),
    })),
  };
});

export const listRooms = createServerFn({ method: "GET" }).handler(async () => {
  const s = await db();
  const [{ data: rooms }, { data: parts }, { data: as }] = await Promise.all([
    s.from("rooms").select("*").order("created_at", { ascending: false }),
    s.from("participants").select("room_id"),
    s.from("assessments").select("room_id"),
  ]);
  return (rooms ?? []).map((r) => ({
    ...r,
    participants: (parts ?? []).filter((p) => p.room_id === r.id).length,
    assessments: (as ?? []).filter((a) => a.room_id === r.id).length,
  }));
});

export const createRoom = createServerFn({ method: "POST" })
  .inputValidator((i) => z.object({
    name: z.string().trim().min(1).max(100), class_name: z.string().trim().max(60),
    description: z.string().trim().max(500).optional(), code: z.string().max(20).optional(),
  }).parse(i))
  .handler(async ({ data }) => {
    const s = await db();
    let code = data.code ? normalizeCode(data.code) : "";
    if (code && code.length < 3) return { ok: false as const, error: "O código precisa ter pelo menos 3 caracteres." };
    if (code) {
      const { data: ex } = await s.from("rooms").select("id").eq("code", code).maybeSingle();
      if (ex) return { ok: false as const, error: "Já existe uma sala com esse código." };
    } else {
      for (let i = 0; i < 10; i++) {
        code = randomCode();
        const { data: ex } = await s.from("rooms").select("id").eq("code", code).maybeSingle();
        if (!ex) break;
      }
    }
    const { data: r, error } = await s.from("rooms").insert({ name: data.name, class_name: data.class_name, description: data.description || null, code }).select("id").single();
    if (error) return { ok: false as const, error: error.code === "23505" ? "Já existe uma sala com esse código." : error.message };
    return { ok: true as const, id: r.id };
  });

export const suggestCode = createServerFn({ method: "GET" }).handler(async () => {
  const s = await db();
  for (let i = 0; i < 10; i++) {
    const code = randomCode();
    const { data } = await s.from("rooms").select("id").eq("code", code).maybeSingle();
    if (!data) return code;
  }
  return randomCode(8);
});

export const updateRoomStatus = createServerFn({ method: "POST" })
  .inputValidator((i) => z.object({ id: uuid, status: z.enum(["rascunho", "ativa", "encerrada", "arquivada"]) }).parse(i))
  .handler(async ({ data }) => {
    const s = await db();
    await s.from("rooms").update({ status: data.status }).eq("id", data.id);
    return { ok: true };
  });

export const deleteRoom = createServerFn({ method: "POST" })
  .inputValidator((i) => z.object({ id: uuid }).parse(i))
  .handler(async ({ data }) => {
    const s = await db();
    await s.from("rooms").delete().eq("id", data.id);
    return { ok: true };
  });

export const getRoomLive = createServerFn({ method: "POST" })
  .inputValidator((i) => z.object({ id: uuid }).parse(i))
  .handler(async ({ data }) => {
    const s = await db();
    const { data: room } = await s.from("rooms").select("*").eq("id", data.id).maybeSingle();
    if (!room) return null;
    const [{ data: assessments }, { data: participants }] = await Promise.all([
      s.from("assessments").select("id,title,type,status,attempt_limit").eq("room_id", room.id).order("created_at"),
      s.from("participants").select("id,name,class_name,entered_at,entry_date").eq("room_id", room.id).order("entered_at", { ascending: false }),
    ]);
    const aIds = (assessments ?? []).map((a) => a.id);
    const { data: subs } = aIds.length
      ? await s.from("submissions").select("id,assessment_id,participant_id,status,started_at,submitted_at,score,max_score,needs_review").in("assessment_id", aIds)
      : { data: [] };
    return { room, assessments: assessments ?? [], participants: participants ?? [], submissions: subs ?? [] };
  });

export const listAssessments = createServerFn({ method: "GET" }).handler(async () => {
  const s = await db();
  const [{ data: as }, { data: rooms }, { data: qs }, { data: subs }] = await Promise.all([
    s.from("assessments").select("*").order("created_at", { ascending: false }),
    s.from("rooms").select("id,name,code"),
    s.from("questions").select("assessment_id"),
    s.from("submissions").select("assessment_id,status"),
  ]);
  return (as ?? []).map((a) => ({
    ...a,
    room: rooms?.find((r) => r.id === a.room_id) ?? null,
    questions: (qs ?? []).filter((q) => q.assessment_id === a.id).length,
    responses: (subs ?? []).filter((x) => x.assessment_id === a.id && x.status === "concluida").length,
  }));
});

export const createAssessment = createServerFn({ method: "POST" })
  .inputValidator((i) => z.object({ type: z.enum(["prova", "atividade", "questionario", "diagnostico"]), room_id: uuid.optional() }).parse(i))
  .handler(async ({ data }) => {
    const s = await db();
    const titles = { prova: "Nova prova", atividade: "Nova atividade", questionario: "Novo questionário", diagnostico: "Nova avaliação diagnóstica" };
    const { data: a, error } = await s.from("assessments").insert({
      type: data.type, title: titles[data.type], room_id: data.room_id ?? null,
      passing_score: data.type === "questionario" ? 0 : 6,
    }).select("id").single();
    if (error) throw error;
    return { id: a.id };
  });

export const getAssessment = createServerFn({ method: "POST" })
  .inputValidator((i) => z.object({ id: uuid }).parse(i))
  .handler(async ({ data }) => {
    const s = await db();
    const { data: a } = await s.from("assessments").select("*").eq("id", data.id).maybeSingle();
    if (!a) return null;
    const { data: qs } = await s.from("questions").select("*").eq("assessment_id", a.id).order("position");
    const ids = (qs ?? []).map((q) => q.id);
    const { data: keys } = ids.length ? await s.from("answer_keys").select("*").in("question_id", ids) : { data: [] };
    const { data: rooms } = await s.from("rooms").select("id,name,code,status").order("name");
    return {
      assessment: a, rooms: rooms ?? [],
      questions: (qs ?? []).map((q) => ({
        id: q.id, type: q.type, prompt: q.prompt, points: Number(q.points),
        options: (q.options as { id: string; text: string }[]) ?? [],
        correct: (keys?.find((k) => k.question_id === q.id)?.correct ?? null) as string | string[] | null,
      })),
    };
  });

const questionSchema = z.object({
  id: uuid, type: z.enum(["unica", "multipla", "vf", "curta", "longa", "escala"]),
  prompt: z.string().trim().min(1, "Toda questão precisa de enunciado").max(2000), points: z.number().min(0).max(100),
  options: z.array(z.object({ id: z.string().max(20), text: z.string().max(500) })).max(20),
  correct: z.union([z.string().max(20), z.array(z.string().max(20)), z.null()]),
});

export const saveAssessment = createServerFn({ method: "POST" })
  .inputValidator((i) => z.object({
    id: uuid,
    fields: z.object({
      title: z.string().trim().min(1).max(200), description: z.string().max(2000).nullable(),
      type: z.enum(["prova", "atividade", "questionario", "diagnostico"]),
      status: z.enum(["rascunho", "disponivel", "encerrada"]), room_id: uuid.nullable(),
      time_limit: z.number().int().min(0).max(600).nullable(), passing_score: z.number().min(0).max(10),
      attempt_limit: z.number().int().min(0).max(3),
    }),
    questions: z.array(questionSchema).max(200),
  }).parse(i))
  .handler(async ({ data }) => {
    const s = await db();
    const { error } = await s.from("assessments").update(data.fields).eq("id", data.id);
    if (error) throw error;
    const { data: existing } = await s.from("questions").select("id").eq("assessment_id", data.id);
    const keep = new Set(data.questions.map((q) => q.id));
    const remove = (existing ?? []).filter((q) => !keep.has(q.id)).map((q) => q.id);
    if (remove.length) await s.from("questions").delete().in("id", remove);
    if (data.questions.length) {
      const { error: qe } = await s.from("questions").upsert(data.questions.map((q, i) => ({
        id: q.id, assessment_id: data.id, position: i + 1, type: q.type, prompt: q.prompt, points: q.points,
        options: ["unica", "multipla", "vf"].includes(q.type) ? q.options : [],
      })));
      if (qe) throw qe;
      const { error: ke } = await s.from("answer_keys").upsert(data.questions.map((q) => ({ question_id: q.id, correct: q.correct })));
      if (ke) throw ke;
    }
    return { ok: true };
  });

export const duplicateAssessment = createServerFn({ method: "POST" })
  .inputValidator((i) => z.object({ id: uuid }).parse(i))
  .handler(async ({ data }) => {
    const s = await db();
    const { data: a } = await s.from("assessments").select("*").eq("id", data.id).single();
    if (!a) throw new Error("Não encontrada");
    const { id: _id, created_at: _c, ...rest } = a;
    const { data: na } = await s.from("assessments").insert({ ...rest, title: `${a.title} (cópia)`, status: "rascunho" }).select("id").single();
    const { data: qs } = await s.from("questions").select("*").eq("assessment_id", a.id);
    for (const q of qs ?? []) {
      const { data: nq } = await s.from("questions").insert({ assessment_id: na!.id, position: q.position, type: q.type, prompt: q.prompt, points: q.points, options: q.options }).select("id").single();
      const { data: k } = await s.from("answer_keys").select("correct").eq("question_id", q.id).maybeSingle();
      if (k && nq) await s.from("answer_keys").insert({ question_id: nq.id, correct: k.correct });
    }
    return { id: na!.id };
  });

export const deleteAssessment = createServerFn({ method: "POST" })
  .inputValidator((i) => z.object({ id: uuid }).parse(i))
  .handler(async ({ data }) => {
    const s = await db();
    await s.from("assessments").delete().eq("id", data.id);
    return { ok: true };
  });

export const getResults = createServerFn({ method: "GET" }).handler(async () => {
  const s = await db();
  const [{ data: subs }, { data: as }, { data: rooms }] = await Promise.all([
    s.from("submissions").select("id,assessment_id,status,started_at,submitted_at,score,max_score,needs_review,participants(name,class_name,entry_date,room_id)").order("started_at", { ascending: false }).limit(3000),
    s.from("assessments").select("id,title,type,passing_score,room_id"),
    s.from("rooms").select("id,name,code"),
  ]);
  return (subs ?? []).map((x) => {
    const p = x.participants as { name: string; class_name: string; entry_date: string; room_id: string } | null;
    const a = as?.find((y) => y.id === x.assessment_id);
    const r = rooms?.find((y) => y.id === p?.room_id);
    const nota = toTen(x.score, x.max_score);
    return {
      id: x.id, status: x.status, started_at: x.started_at, submitted_at: x.submitted_at, needs_review: x.needs_review,
      nota, aprovado: nota == null ? null : nota >= Number(a?.passing_score ?? 6),
      name: p?.name ?? "—", class_name: p?.class_name ?? "—", date: p?.entry_date ?? "",
      assessment_id: x.assessment_id, assessment: a?.title ?? "—", type: a?.type ?? "",
      room_id: r?.id ?? "", room: r ? `${r.name} (${r.code})` : "—",
    };
  });
});

export const getSubmission = createServerFn({ method: "POST" })
  .inputValidator((i) => z.object({ id: uuid }).parse(i))
  .handler(async ({ data }) => {
    const s = await db();
    const { data: sub } = await s.from("submissions").select("*,participants(name,class_name,entry_date)").eq("id", data.id).maybeSingle();
    if (!sub) return null;
    const { data: a } = await s.from("assessments").select("title,type,passing_score").eq("id", sub.assessment_id).single();
    const { data: qs } = await s.from("questions").select("*").eq("assessment_id", sub.assessment_id).order("position");
    const ids = (qs ?? []).map((q) => q.id);
    const [{ data: keys }, { data: answers }] = await Promise.all([
      ids.length ? s.from("answer_keys").select("*").in("question_id", ids) : Promise.resolve({ data: [] as { question_id: string; correct: unknown }[] }),
      s.from("answers").select("*").eq("submission_id", sub.id),
    ]);
    return {
      submission: sub, assessment: a,
      items: (qs ?? []).map((q) => ({
        question: { ...q, options: (q.options as { id: string; text: string }[]) ?? [] },
        correct: keys?.find((k) => k.question_id === q.id)?.correct ?? null,
        answer: answers?.find((x) => x.question_id === q.id) ?? null,
      })),
    };
  });

export const gradeManual = createServerFn({ method: "POST" })
  .inputValidator((i) => z.object({ answerId: uuid, score: z.number().min(0).max(100) }).parse(i))
  .handler(async ({ data }) => {
    const s = await db();
    const { data: ans } = await s.from("answers").select("id,submission_id,question_id").eq("id", data.answerId).single();
    if (!ans) throw new Error("Resposta não encontrada");
    const { data: q } = await s.from("questions").select("points").eq("id", ans.question_id).single();
    const pts = Math.min(data.score, Number(q?.points ?? 0));
    await s.from("answers").update({ score_awarded: pts, is_correct: pts > 0 }).eq("id", ans.id);
    const { data: all } = await s.from("answers").select("score_awarded,question_id").eq("submission_id", ans.submission_id);
    const { data: qs } = await s.from("questions").select("id,type,points").in("id", (all ?? []).map((x) => x.question_id));
    const pending = (all ?? []).some((x) => {
      const qq = qs?.find((y) => y.id === x.question_id);
      return x.score_awarded == null && qq && qq.type !== "escala" && Number(qq.points) > 0;
    });
    const total = (all ?? []).reduce((t, x) => t + Number(x.score_awarded ?? 0), 0);
    await s.from("submissions").update({ score: total, needs_review: pending }).eq("id", ans.submission_id);
    return { ok: true };
  });

export const getAnalysis = createServerFn({ method: "POST" })
  .inputValidator((i) => z.object({ id: uuid }).parse(i))
  .handler(async ({ data }) => {
    const s = await db();
    const { data: a } = await s.from("assessments").select("*").eq("id", data.id).maybeSingle();
    if (!a) return null;
    const { data: qs } = await s.from("questions").select("*").eq("assessment_id", a.id).order("position");
    const { data: subs } = await s.from("submissions").select("id,score,max_score,status,participants(name,class_name)").eq("assessment_id", a.id).eq("status", "concluida");
    const sIds = (subs ?? []).map((x) => x.id);
    const { data: answers } = sIds.length ? await s.from("answers").select("submission_id,question_id,answer,is_correct").in("submission_id", sIds) : { data: [] };
    const notes = (subs ?? []).map((x) => toTen(x.score, x.max_score)).filter((n): n is number => n != null);
    const pass = Number(a.passing_score);
    const nameOf = (sid: string) => ((subs ?? []).find((x) => x.id === sid)?.participants as { name: string; class_name: string } | null);
    return {
      assessment: a,
      total: sIds.length,
      stats: notes.length ? {
        media: Math.round((notes.reduce((t, n) => t + n, 0) / notes.length) * 10) / 10,
        maior: Math.max(...notes), menor: Math.min(...notes),
        aprovacao: Math.round((notes.filter((n) => n >= pass).length / notes.length) * 100),
        distribuicao: [0, 2, 4, 6, 8].map((lo) => ({ faixa: `${lo}–${lo + 2}`, n: notes.filter((n) => n >= lo && (lo === 8 ? n <= 10 : n < lo + 2)).length })),
      } : null,
      questions: (qs ?? []).map((q) => {
        const opts = (q.options as { id: string; text: string }[]) ?? [];
        const qa = (answers ?? []).filter((x) => x.question_id === q.id);
        const counts: Record<string, number> = {};
        for (const x of qa) {
          const v = x.answer as unknown;
          const list = Array.isArray(v) ? v : v == null ? [] : [String(v)];
          for (const k of list) counts[String(k)] = (counts[String(k)] ?? 0) + 1;
        }
        const graded = qa.filter((x) => x.is_correct != null);
        return {
          id: q.id, position: q.position, type: q.type, prompt: q.prompt, answered: qa.length,
          acerto: graded.length && Number(q.points) > 0 ? Math.round((graded.filter((x) => x.is_correct).length / graded.length) * 100) : null,
          options: q.type === "escala"
            ? ["1", "2", "3", "4", "5"].map((k) => ({ id: k, text: k, n: counts[k] ?? 0 }))
            : opts.map((o) => ({ ...o, n: counts[o.id] ?? 0 })),
          texts: ["curta", "longa"].includes(q.type)
            ? qa.filter((x) => x.answer).map((x) => ({ text: String(x.answer), name: nameOf(x.submission_id)?.name ?? "—", class_name: nameOf(x.submission_id)?.class_name ?? "" }))
            : [],
        };
      }),
    };
  });

export const generateDemoData = createServerFn({ method: "POST" }).handler(async () => {
  const s = await db();

  // 1. Create Room INFO26
  const { data: roomInfo } = await s.from("rooms").insert({
    name: "Informática — Terça-feira",
    class_name: "Informática",
    description: "Laboratório 2 - Período da tarde",
    code: "INFO26",
    status: "ativa",
  }).select("id").single();

  const infoId = roomInfo?.id;

  // 2. Create Room EXCEL7
  const { data: roomExcel } = await s.from("rooms").insert({
    name: "Turma de Excel Básico",
    class_name: "Excel",
    description: "Módulo Planilhas",
    code: "EXCEL7",
    status: "ativa",
  }).select("id").single();

  // 3. Create Room WORD3
  await s.from("rooms").insert({
    name: "Turma de Word e Redação",
    class_name: "Word",
    description: "Módulo Textos",
    code: "WORD3",
    status: "ativa",
  });

  if (!infoId) return { ok: true };

  // 4. Create Assessment: Prova de Excel
  const { data: aProva } = await s.from("assessments").insert({
    title: "Prova de Excel",
    description: "Avaliação bimestral de fórmulas, gráficos e funções básicas no Excel.",
    type: "prova",
    status: "disponivel",
    room_id: infoId,
    passing_score: 6,
    attempt_limit: 1,
    time_limit: 45,
  }).select("id").single();

  if (aProva) {
    const q1 = crypto.randomUUID();
    const q2 = crypto.randomUUID();
    const q3 = crypto.randomUUID();
    const q4 = crypto.randomUUID();

    await s.from("questions").insert([
      {
        id: q1,
        assessment_id: aProva.id,
        position: 1,
        type: "unica",
        prompt: "Qual fórmula é utilizada para calcular a soma de um intervalo de células de A1 até A10?",
        points: 2.5,
        options: [
          { id: "a", text: "=TOTAL(A1:A10)" },
          { id: "b", text: "=SOMA(A1:A10)" },
          { id: "c", text: "=CALCULAR(A1..A10)" },
          { id: "d", text: "=ADD(A1:A10)" },
        ],
      },
      {
        id: q2,
        assessment_id: aProva.id,
        position: 2,
        type: "multipla",
        prompt: "Quais das seguintes opções são tipos válidos de gráficos no Excel? (Selecione todos os corretos)",
        points: 2.5,
        options: [
          { id: "a", text: "Gráfico de Colunas" },
          { id: "b", text: "Gráfico de Pizza" },
          { id: "c", text: "Gráfico de Linhas" },
          { id: "d", text: "Gráfico de Satélite" },
        ],
      },
      {
        id: q3,
        assessment_id: aProva.id,
        position: 3,
        type: "vf",
        prompt: "No Excel, toda fórmula matemática obrigatóriamente deve começar com o sinal de igual (=).",
        points: 2.5,
        options: [
          { id: "v", text: "Verdadeiro" },
          { id: "f", text: "Falso" },
        ],
      },
      {
        id: q4,
        assessment_id: aProva.id,
        position: 4,
        type: "longa",
        prompt: "Explique a diferença prática entre as funções =MÉDIA() e =SOMA() e dê um exemplo de uso de cada uma.",
        points: 2.5,
        options: [],
      },
    ]);

    await s.from("answer_keys").insert([
      { question_id: q1, correct: "b" },
      { question_id: q2, correct: ["a", "b", "c"] },
      { question_id: q3, correct: "v" },
      { question_id: q4, correct: null },
    ]);
  }

  // 5. Create Assessment: Pesquisa sobre as Aulas (Questionário)
  const { data: aSurvey } = await s.from("assessments").insert({
    title: "Pesquisa sobre as próximas aulas",
    description: "Queremos saber sua opinião e preferências para os próximos conteúdos.",
    type: "questionario",
    status: "disponivel",
    room_id: infoId,
    passing_score: 0,
    attempt_limit: 0,
    time_limit: null,
  }).select("id").single();

  if (aSurvey) {
    const sq1 = crypto.randomUUID();
    const sq2 = crypto.randomUUID();
    const sq3 = crypto.randomUUID();
    const sq4 = crypto.randomUUID();
    const sq5 = crypto.randomUUID();

    await s.from("questions").insert([
      {
        id: sq1,
        assessment_id: aSurvey.id,
        position: 1,
        type: "multipla",
        prompt: "Quais conteúdos você gostaria de aprender nas próximas semanas?",
        points: 0,
        options: [
          { id: "a", text: "Excel avançado e PROCV" },
          { id: "b", text: "Inteligência Artificial e Prompts" },
          { id: "c", text: "Montagem e Manutenção de Hardware" },
          { id: "d", text: "Lógica de Programação e Python" },
          { id: "e", text: "Edição de Vídeo e Imagem" },
        ],
      },
      {
        id: sq2,
        assessment_id: aSurvey.id,
        position: 2,
        type: "unica",
        prompt: "Qual formato de aula você prefere?",
        points: 0,
        options: [
          { id: "a", text: "Aulas práticas com laboratório" },
          { id: "b", text: "Exercícios e listas individuais" },
          { id: "c", text: "Projetos práticos em grupo" },
          { id: "d", text: "Desafios gamificados" },
        ],
      },
      {
        id: sq3,
        assessment_id: aSurvey.id,
        position: 3,
        type: "curta",
        prompt: "Em qual assunto você sente maior dificuldade atualmente?",
        points: 0,
        options: [],
      },
      {
        id: sq4,
        assessment_id: aSurvey.id,
        position: 4,
        type: "longa",
        prompt: "Deixe um comentário, sugestão ou feedback para o professor:",
        points: 0,
        options: [],
      },
      {
        id: sq5,
        assessment_id: aSurvey.id,
        position: 5,
        type: "escala",
        prompt: "De 1 a 5, como você avalia o ritmo e a clareza das aulas até agora?",
        points: 0,
        options: [],
      },
    ]);
  }

  // 6. Create Participants and Submissions in INFO26
  const { data: p1 } = await s.from("participants").insert({
    room_id: infoId,
    name: "João Victor Silveira",
    class_name: "Informática",
  }).select("id").single();

  const { data: p2 } = await s.from("participants").insert({
    room_id: infoId,
    name: "Maria Silva Santos",
    class_name: "Informática",
  }).select("id").single();

  await s.from("participants").insert({
    room_id: infoId,
    name: "Carlos Souza Oliveira",
    class_name: "Informática",
  });

  const { data: p4 } = await s.from("participants").insert({
    room_id: infoId,
    name: "Ana Paula Ferreira",
    class_name: "Informática",
  }).select("id").single();

  // Create completed submission for João Victor
  if (p1 && aProva) {
    const started = new Date(Date.now() - 35 * 60 * 1000).toISOString();
    const submitted = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: sub1 } = await s.from("submissions").insert({
      assessment_id: aProva.id,
      participant_id: p1.id,
      status: "concluida",
      started_at: started,
      submitted_at: submitted,
      score: 7.5,
      max_score: 10,
      needs_review: true,
    }).select("id").single();

    if (sub1) {
      const { data: qs } = await s.from("questions").select("id,position").eq("assessment_id", aProva.id);
      for (const q of qs ?? []) {
        if (q.position === 1) {
          await s.from("answers").insert({ submission_id: sub1.id, question_id: q.id, answer: "b", is_correct: true, score_awarded: 2.5 });
        } else if (q.position === 2) {
          await s.from("answers").insert({ submission_id: sub1.id, question_id: q.id, answer: ["a", "b", "c"], is_correct: true, score_awarded: 2.5 });
        } else if (q.position === 3) {
          await s.from("answers").insert({ submission_id: sub1.id, question_id: q.id, answer: "v", is_correct: true, score_awarded: 2.5 });
        } else if (q.position === 4) {
          await s.from("answers").insert({ submission_id: sub1.id, question_id: q.id, answer: "A SOMA calcula a soma total dos valores selecionados. A MÉDIA soma e divide pela quantidade para achar a média aritmética.", is_correct: null, score_awarded: null });
        }
      }
    }
  }

  // Create in-progress submission for Maria Silva
  if (p2 && aProva) {
    await s.from("submissions").insert({
      assessment_id: aProva.id,
      participant_id: p2.id,
      status: "em_andamento",
      started_at: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
    });
  }

  // Create completed submission for Ana Paula
  if (p4 && aProva) {
    const started = new Date(Date.now() - 40 * 60 * 1000).toISOString();
    const submitted = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    await s.from("submissions").insert({
      assessment_id: aProva.id,
      participant_id: p4.id,
      status: "concluida",
      started_at: started,
      submitted_at: submitted,
      score: 10.0,
      max_score: 10,
      needs_review: false,
    });
  }

  // Survey submission for João Victor
  if (p1 && aSurvey) {
    const { data: sSub } = await s.from("submissions").insert({
      assessment_id: aSurvey.id,
      participant_id: p1.id,
      status: "concluida",
      started_at: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
      submitted_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    }).select("id").single();

    if (sSub) {
      const { data: qs } = await s.from("questions").select("id,position").eq("assessment_id", aSurvey.id);
      for (const q of qs ?? []) {
        if (q.position === 1) await s.from("answers").insert({ submission_id: sSub.id, question_id: q.id, answer: ["a", "b"] });
        if (q.position === 2) await s.from("answers").insert({ submission_id: sSub.id, question_id: q.id, answer: "a" });
        if (q.position === 3) await s.from("answers").insert({ submission_id: sSub.id, question_id: q.id, answer: "Formatação condicional" });
        if (q.position === 4) await s.from("answers").insert({ submission_id: sSub.id, question_id: q.id, answer: "As aulas práticas no laboratório são excelentes, continue assim!" });
        if (q.position === 5) await s.from("answers").insert({ submission_id: sSub.id, question_id: q.id, answer: "5" });
      }
    }
  }

  return { ok: true };
});

export const clearAllData = createServerFn({ method: "POST" }).handler(async () => {
  const s = await db();
  await s.from("answers").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await s.from("submissions").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await s.from("answer_keys").delete().neq("question_id", "00000000-0000-0000-0000-000000000000");
  await s.from("questions").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await s.from("assessments").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await s.from("participants").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await s.from("rooms").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  return { ok: true };
});

