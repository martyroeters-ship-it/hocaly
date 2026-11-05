import { completeJson } from "@/lib/ai/provider"
import { conversationReportPrompt, conversationTurnPrompt, speakingEvalPrompt } from "@/lib/ai/prompts"
import { conversationReportSchema, conversationTurnSchema, speakingEvalSchema } from "@/lib/ai/schemas"
import { prisma } from "@/lib/prisma"
import { applySkillReview } from "@/lib/repos/skills"
import { getWordsByIds } from "@/lib/repos/words"
import { compareSpoken } from "@/lib/speech/compare"
import { deleteFileIfPresent, recordingPath, writeAudioFile } from "@/lib/speech/fs"
import type { CefrLevel, EvalResult, SpeakingMode, SpokenFeedback } from "@/lib/types"

function englishOf(word: { meanings: { english: string; isPrimary: boolean }[] }) {
  return word.meanings.find((item) => item.isPrimary)?.english ?? word.meanings[0]?.english ?? ""
}

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

export type SpeakItem = {
  wordId: string
  turkish: string
  english: string
  accepted?: string[]
}

export function serializeSession(row: {
  id: string
  mode: string
  topic: string | null
  cefrLevel: string
  speed: number
  durationSec: number | null
  itemsJson: string
  messagesJson: string
  reportJson: string | null
  createdAt: Date
  completedAt: Date | null
}) {
  return {
    id: row.id,
    mode: row.mode,
    topic: row.topic,
    cefrLevel: row.cefrLevel,
    speed: row.speed,
    durationSec: row.durationSec,
    items: parseJson<SpeakItem[]>(row.itemsJson, []),
    messages: parseJson<{ role: string; turkish: string; english?: string; transcript?: string }[]>(row.messagesJson, []),
    report: row.reportJson ? parseJson(row.reportJson, null) : null,
    createdAt: row.createdAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
  }
}

export async function startSpeakingSession(options: {
  mode: SpeakingMode
  wordIds: string[]
  topic?: string
  cefr: CefrLevel
  speed: number
  durationSec?: number
}) {
  const words = await getWordsByIds(options.wordIds)
  if (!words.length) throw new Error("Select vocabulary first")
  const items: SpeakItem[] = words.map((word) => ({
    wordId: word.id,
    turkish: word.examples[0]?.highlight || word.turkish,
    english: word.examples[0]?.english || englishOf(word),
    accepted: [
      word.examples[0]?.turkish,
      word.turkish,
      word.dictionaryForm ?? undefined,
    ].filter(Boolean) as string[],
  }))

  const profile = await prisma.grammarProfile.findUnique({ where: { id: "default" } })
  const known = JSON.parse(profile?.knownJson ?? "[]") as string[]
  const introduceNew = profile?.introduceNew ?? false
  const messages: { role: string; turkish: string; english?: string }[] = []

  if (options.mode === "conversation") {
    try {
      const prompt = conversationTurnPrompt({
        topic: options.topic || "daily life",
        cefr: options.cefr,
        targetWords: items.map((item) => ({ turkish: item.turkish, english: item.english })),
        messages: [],
        remainingSec: options.durationSec ?? 120,
        knownGrammar: known,
        introduceNew,
      })
      const turn = await completeJson({
        kind: "conversation-turn",
        schema: conversationTurnSchema,
        system: prompt.system,
        user: prompt.user,
        cache: false,
      })
      messages.push({ role: "assistant", turkish: turn.turkish, english: turn.english })
    } catch {
      messages.push({
        role: "assistant",
        turkish: "Merhaba! Bugün nasıl geçiyor?",
        english: "Hello! How is your day going?",
      })
    }
  }

  const row = await prisma.speakingSession.create({
    data: {
      mode: options.mode,
      topic: options.topic,
      cefrLevel: options.cefr,
      speed: options.speed,
      durationSec: options.durationSec,
      itemsJson: JSON.stringify(items),
      messagesJson: JSON.stringify(messages),
    },
  })

  if (messages[0]) {
    await prisma.speakingTurn.create({
      data: {
        sessionId: row.id,
        role: "assistant",
        turkish: messages[0].turkish,
        english: messages[0].english,
      },
    })
  }

  return serializeSession(row)
}

export async function evaluateSpokenTurn(options: {
  sessionId: string
  itemIndex: number
  transcript: string
  recording?: { buffer: Buffer; mimeType: string } | null
  keepRecording: boolean
}) {
  const session = await prisma.speakingSession.findUnique({ where: { id: options.sessionId } })
  if (!session) throw new Error("Session not found")
  const items = parseJson<SpeakItem[]>(session.itemsJson, [])
  const item = items[options.itemIndex]
  if (!item) throw new Error("No sentence for this turn")

  const expected = session.mode === "translate-speak" ? item.accepted?.[0] || item.turkish : item.accepted?.[0] || item.turkish
  let feedback: SpokenFeedback = compareSpoken(expected, options.transcript)

  if (session.mode === "translate-speak") {
    try {
      const prompt = speakingEvalPrompt({
        mode: "translate-speak",
        english: item.english,
        expected: (item.accepted ?? [item.turkish]).join(" | "),
        transcript: options.transcript,
        targetWords: [item.turkish],
      })
      const ai = await completeJson({
        kind: "speaking-eval",
        schema: speakingEvalSchema,
        system: prompt.system,
        user: prompt.user,
        cache: false,
      })
      feedback = {
        ...feedback,
        result: ai.result,
        explanation: ai.explanation,
        vocabulary: ai.vocabulary,
        grammar: ai.grammar,
        naturalness: ai.naturalness,
      }
    } catch {
      feedback.explanation = feedback.result === "correct"
        ? "The recognized words match a valid translation."
        : "Check missing words and grammar. Alternative correct translations are accepted."
    }
  } else {
    feedback.explanation =
      feedback.result === "correct"
        ? "The recognized words match the sentence."
        : `Missing: ${feedback.missing.join(", ") || "—"}. This is word accuracy, not pronunciation.`
  }

  let recordingKey: string | undefined
  if (options.keepRecording && options.recording) {
    recordingKey = `${session.id}-${Date.now()}`
    const ext = options.recording.mimeType.includes("wav") ? "wav" : "webm"
    await writeAudioFile(recordingPath(recordingKey, ext), options.recording.buffer)
  }

  await prisma.speakingTurn.create({
    data: {
      sessionId: session.id,
      role: "user",
      turkish: item.turkish,
      english: item.english,
      transcript: options.transcript,
      expected,
      feedbackJson: JSON.stringify(feedback),
      recordingKey,
    },
  })

  await applySkillReview({
    wordId: item.wordId,
    skill: "speaking",
    result: feedback.result,
    source: session.mode,
  })

  return { feedback, item }
}

export async function conversationReply(options: {
  sessionId: string
  transcript: string
  elapsedSec: number
  recording?: { buffer: Buffer; mimeType: string } | null
  keepRecording: boolean
}) {
  const session = await prisma.speakingSession.findUnique({ where: { id: options.sessionId } })
  if (!session) throw new Error("Session not found")
  const items = parseJson<SpeakItem[]>(session.itemsJson, [])
  const messages = parseJson<{ role: string; turkish: string; english?: string; transcript?: string }[]>(session.messagesJson, [])
  messages.push({ role: "user", turkish: options.transcript, transcript: options.transcript })

  const profile = await prisma.grammarProfile.findUnique({ where: { id: "default" } })
  const known = JSON.parse(profile?.knownJson ?? "[]") as string[]
  const remainingSec = Math.max(0, (session.durationSec ?? 120) - options.elapsedSec)
  const prompt = conversationTurnPrompt({
    topic: session.topic || "daily life",
    cefr: session.cefrLevel as CefrLevel,
    targetWords: items.map((item) => ({ turkish: item.turkish, english: item.english })),
    messages,
    remainingSec,
    knownGrammar: known,
    introduceNew: profile?.introduceNew ?? false,
  })
  const turn = await completeJson({
    kind: "conversation-turn",
    schema: conversationTurnSchema,
    system: prompt.system,
    user: prompt.user,
    cache: false,
  })
  messages.push({ role: "assistant", turkish: turn.turkish, english: turn.english })

  let recordingKey: string | undefined
  if (options.keepRecording && options.recording) {
    recordingKey = `${session.id}-${Date.now()}`
    await writeAudioFile(recordingPath(recordingKey, "webm"), options.recording.buffer)
  }

  await prisma.speakingTurn.create({
    data: {
      sessionId: session.id,
      role: "user",
      transcript: options.transcript,
      recordingKey,
    },
  })
  await prisma.speakingTurn.create({
    data: {
      sessionId: session.id,
      role: "assistant",
      turkish: turn.turkish,
      english: turn.english,
    },
  })
  await prisma.speakingSession.update({
    where: { id: session.id },
    data: { messagesJson: JSON.stringify(messages) },
  })

  return { reply: turn, messages, remainingSec }
}

export async function finishConversation(sessionId: string) {
  const session = await prisma.speakingSession.findUnique({ where: { id: sessionId }, include: { turns: true } })
  if (!session) throw new Error("Session not found")
  const items = parseJson<SpeakItem[]>(session.itemsJson, [])
  const messages = parseJson<{ role: string; turkish: string; transcript?: string }[]>(session.messagesJson, [])
  const prompt = conversationReportPrompt({
    topic: session.topic || "daily life",
    cefr: session.cefrLevel as CefrLevel,
    targetWords: items.map((item) => ({ turkish: item.turkish, english: item.english })),
    messages,
  })
  const report = await completeJson({
    kind: "conversation-report",
    schema: conversationReportSchema,
    system: prompt.system,
    user: prompt.user,
    cache: false,
  })

  const used = new Set(report.targetUsed.map((item) => item.toLowerCase()))
  for (const item of items) {
    await applySkillReview({
      wordId: item.wordId,
      skill: "speaking",
      result: used.has(item.turkish.toLowerCase()) ? "correct" : "incorrect",
      source: "conversation",
    })
  }

  const row = await prisma.speakingSession.update({
    where: { id: sessionId },
    data: {
      reportJson: JSON.stringify(report),
      completedAt: new Date(),
    },
  })
  return serializeSession(row)
}

export async function listRecordings() {
  const turns = await prisma.speakingTurn.findMany({
    where: { recordingKey: { not: null } },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { session: true },
  })
  return turns.map((turn) => ({
    id: turn.id,
    sessionId: turn.sessionId,
    mode: turn.session.mode,
    transcript: turn.transcript,
    expected: turn.expected,
    recordingKey: turn.recordingKey,
    createdAt: turn.createdAt.toISOString(),
  }))
}

export async function deleteRecording(turnId: string) {
  const turn = await prisma.speakingTurn.findUnique({ where: { id: turnId } })
  if (!turn?.recordingKey) return { deleted: 0 }
  await deleteFileIfPresent(recordingPath(turn.recordingKey, "webm"))
  await deleteFileIfPresent(recordingPath(turn.recordingKey, "wav"))
  await prisma.speakingTurn.update({
    where: { id: turnId },
    data: { recordingKey: null, transcript: null },
  })
  return { deleted: 1 }
}

export async function deleteAllRecordings() {
  const turns = await prisma.speakingTurn.findMany({ where: { recordingKey: { not: null } } })
  for (const turn of turns) {
    if (!turn.recordingKey) continue
    await deleteFileIfPresent(recordingPath(turn.recordingKey, "webm"))
    await deleteFileIfPresent(recordingPath(turn.recordingKey, "wav"))
  }
  const result = await prisma.speakingTurn.updateMany({
    where: { recordingKey: { not: null } },
    data: { recordingKey: null, transcript: null },
  })
  return { deleted: result.count }
}
