import { fail } from "@/lib/api"
import { prisma, ensureDb } from "@/lib/prisma"

export async function GET(request: Request) {
  try {
    await ensureDb()
    const url = new URL(request.url)
    const kind = url.searchParams.get("kind") ?? "vocabulary"

    if (kind === "progress") {
      const [words, reviews, days] = await Promise.all([
        prisma.word.findMany({ select: { turkish: true, learningStatus: true, reviewCount: true, correctCount: true, nextReviewAt: true } }),
        prisma.reviewLog.findMany({ orderBy: { review: "asc" } }),
        prisma.studyDay.findMany({ orderBy: { date: "asc" } }),
      ])
      return new Response(JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), words, reviews, days }, null, 2), {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": "attachment; filename=kelime-progress.json",
        },
      })
    }

    const words = await prisma.word.findMany({
      include: { meanings: true, tags: { include: { tag: true } }, examples: true },
      orderBy: { turkishNormalized: "asc" },
    })
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      words: words.map((word) => ({
        turkish: word.turkish,
        english: word.meanings.find((item) => item.isPrimary)?.english ?? word.meanings[0]?.english,
        meanings: word.meanings.map((item) => item.english),
        partOfSpeech: word.partOfSpeech,
        cefrLevel: word.cefrLevel,
        tags: word.tags.map((item) => item.tag.name),
        examples: word.examples.map((item) => ({ turkish: item.turkish, english: item.english })),
      })),
    }
    return new Response(JSON.stringify(payload, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": "attachment; filename=kelime-vocabulary.json",
      },
    })
  } catch (error) {
    return fail(error)
  }
}
