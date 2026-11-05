import { fail, ok, readBody } from "@/lib/api"
import { prisma, ensureDb } from "@/lib/prisma"

export async function GET() {
  try {
    await ensureDb()
    const stories = await prisma.story.findMany({ orderBy: { createdAt: "desc" }, take: 50 })
    return ok({
      stories: stories.map((story) => ({
        ...story,
        sentences: JSON.parse(story.sentencesJson),
        questions: JSON.parse(story.questionsJson),
        usedWords: JSON.parse(story.usedJson),
        omittedWords: JSON.parse(story.omittedJson),
        grammarNotes: JSON.parse(story.grammarJson),
      })),
    })
  } catch (error) {
    return fail(error)
  }
}

export async function DELETE(request: Request) {
  try {
    await ensureDb()
    const body = await readBody<{ id: string }>(request)
    await prisma.story.delete({ where: { id: body.id } })
    return ok({ ok: true })
  } catch (error) {
    return fail(error)
  }
}
