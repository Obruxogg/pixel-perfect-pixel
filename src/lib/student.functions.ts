import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { canAttempt, gradeAnswer, normalizeCode, type QType } from "./grading";

const db = async () => (await import("@/integrations/supabase/client.server")).supabaseAdmin;
const UNAVAILABLE = "Esta sala não está disponível no momento.";

export const findRoom = createServerFn({ method: "POST" })
  .inputValidator((i) => z.object({ code: z.string().min(1).max(20) }).parse(i))
  .handler(async ({ data }) => {
    const s = await db();
    const { data: room } = await s.from("rooms").select("id,name,class_name,code,status").eq("code", normalizeCode(data.code)).maybeSingle();
    if (!room) return { ok: false as const, error: "Código não encontrado. Confira com o professor." };
    if (room.status !== "ativa") return { ok: false as const, error: UNAVAILABLE };
    return { ok: true as const, room: { id: room.id, name: room.name, class_name: room.class_name, code: room.code } };
  });

export const joinRoom = createServerFn({ method: "POST" })
  .inputValidator((i) =>
    z.object({
      code: z.string().min(1).max(20),
      name: z.string().trim().min(3, "Informe seu nome completo").max(100),
      className: z.string().trim().min(1, "Informe a turma").max(60),
    }).parse(i),
  )
  .handler(async ({ data }) => {
    const s = await db();
    const { data: room } = await s.from("rooms").select("id,status").eq("code", normalizeCode(data.code)).maybeSingle();
    if (!room || room.status !== "ativa") return { ok: false as const, error: UNAVAILABLE };
    const { data: p, error } = await s.from("participants")
      .insert({ room_id: room.id, name: data.name, class_name: data.className })
      .select("id").single();
    if (error) throw error;
    return { ok: true as const, participantId: p.id };
  });

async function sameStudentIds(s: Awaited<ReturnType<typeof db>>, participantId: string) {
  const { data: me } = await s.from("participants").select("id,room_id,name,class_name").eq("id", participantId).maybeSingle();
  if (!me) return null;
  const { data: all } = await s.from("participants").select("id,name,class_name").eq("room_id", me.room_id);
  const key = (n: string, c: string) => `${n.trim().toLowerCase()}|${c.trim().toLowerCase()}`;
  const k = key(me.name, me.class_name);
  const ids = (all ?? []).filter((p) => key(p.name, p.class_name) === k).map((p) => p.id);
  return { me, ids };
}

export const getStudentRoom = createServerFn({ method: "POST" })
  .inputValidator((i) => z.object({ participantId: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const s = await db();
    const ctx = await sameStudentIds(s, data.participantId);
    if (!ctx) return { ok: false as const, error: "Identificação não encontrada." };
    const { data: room } = await s.from("rooms").select("id,name,code,status").eq("id", ctx.me.room_id).single();
    if (!room || room.status !== "ativa") return { ok: false as const, error: UNAVAILABLE };
    const { data: assessments } = await s.from("assessments").select("id,title,type,status,attempt_limit,time_limit")
      .eq("room_id", room.id).neq("status", "rascunho").order("created_at");
    const { data: subs } = await s.from("submissions").select("assessment_id,status").in("participant_id", ctx.ids);
    const list = (assessments ?? []).map((a) => {
      const done = (subs ?? []).filter((x) => x.assessment_id === a.id && x.status === "concluida").length;
      return { ...a, completed: done, canStart: a.status === "disponivel" && canAttempt(done, a.attempt_limit) };
    });
    return { ok: true as const, room, participant: { name: ctx.me.name, class_name: ctx.me.class_name }, assessments: list };
  });

export const startAssessment = createServerFn({ method: "POST" })
  .inputValidator((i) => z.object({ participantId: z.string().uuid(), assessmentId: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const s = await db();
    const ctx = await sameStudentIds(s, data.participantId);
    if (!ctx) return { ok: false as const, error: "Identificação não encontrada." };
    const { data: a } = await s.from("assessments").select("id,room_id,title,description,type,status,attempt_limit,time_limit").eq("id", data.assessmentId).single();
    const { data: room } = await s.from("rooms").select("status").eq("id", ctx.me.room_id).single();
    if (!a || a.room_id !== ctx.me.room_id || a.status !== "disponivel" || room?.status !== "ativa")
      return { ok: false as const, error: "Esta avaliação não está disponível." };
    const { data: subs } = await s.from("submissions").select("id,status,participant_id").eq("assessment_id", a.id).in("participant_id", ctx.ids);
    const done = (subs ?? []).filter((x) => x.status === "concluida").length;
    if (!canAttempt(done, a.attempt_limit)) return { ok: false as const, error: "Esta avaliação já foi respondida." };
    let submissionId = (subs ?? []).find((x) => x.status === "em_andamento" && x.participant_id === ctx.me.id)?.id;
    if (!submissionId) {
      const { data: sub, error } = await s.from("submissions").insert({ assessment_id: a.id, participant_id: ctx.me.id }).select("id").single();
      if (error) throw error;
      submissionId = sub.id;
    }
    const { data: qs } = await s.from("questions").select("id,position,type,prompt,points,options").eq("assessment_id", a.id).order("position");
    return {
      ok: true as const, submissionId,
      assessment: { title: a.title, description: a.description, type: a.type, time_limit: a.time_limit },
      questions: (qs ?? []).map((q) => ({ ...q, options: (q.options as { id: string; text: string }[]) ?? [] })),
    };
  });

export const submitAssessment = createServerFn({ method: "POST" })
  .inputValidator((i) =>
    z.object({
      submissionId: z.string().uuid(),
      answers: z.record(z.string().uuid(), z.union([z.string().max(5000), z.number(), z.array(z.string().max(50)).max(30), z.null()])),
    }).parse(i),
  )
  .handler(async ({ data }) => {
    const s = await db();
    const { data: sub } = await s.from("submissions").select("id,assessment_id,status").eq("id", data.submissionId).single();
    if (!sub) return { ok: false as const, error: "Envio não encontrado." };
    if (sub.status === "concluida") return { ok: false as const, error: "Esta avaliação já foi enviada." };
    const { data: qs } = await s.from("questions").select("id,type,points,options").eq("assessment_id", sub.assessment_id);
    const ids = (qs ?? []).map((q) => q.id);
    const { data: keys } = ids.length ? await s.from("answer_keys").select("question_id,correct").in("question_id", ids) : { data: [] };
    let score = 0, max = 0, review = false;
    const rows = (qs ?? []).map((q) => {
      const ans = data.answers[q.id] ?? null;
      const opts = (q.options as { id: string; text: string }[]) ?? [];
      const g = gradeAnswer(q.type as QType, Number(q.points), keys?.find((k) => k.question_id === q.id)?.correct ?? null, ans, opts);
      if (q.type !== "escala") max += Number(q.points);
      score += g.score_awarded ?? 0;
      review ||= g.needs_review;
      return { submission_id: sub.id, question_id: q.id, answer: ans, is_correct: g.is_correct, score_awarded: g.score_awarded };
    });
    if (rows.length) {
      const { error } = await s.from("answers").upsert(rows, { onConflict: "submission_id,question_id" });
      if (error) throw error;
    }
    await s.from("submissions").update({
      status: "concluida", submitted_at: new Date().toISOString(),
      score: max > 0 ? score : null, max_score: max > 0 ? max : null, needs_review: review,
    }).eq("id", sub.id);
    return { ok: true as const };
  });
