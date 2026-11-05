import { copyFile, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { fail, ok, readBody } from "@/lib/api"
import { ensureDb, prisma } from "@/lib/prisma"

const dbPath = () => path.join(process.cwd(), "prisma", "dev.db")

export async function GET() {
  try {
    await ensureDb()
    const bytes = await readFile(dbPath())
    return new Response(bytes, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": "attachment; filename=kelime-backup.db",
      },
    })
  } catch (error) {
    return fail(error)
  }
}

export async function POST(request: Request) {
  try {
    const body = await readBody<{ action: "wipe" | "restore"; backup?: string }>(request)
    await ensureDb()
    if (body.action === "wipe") {
      await prisma.$transaction([
        prisma.listeningAttempt.deleteMany(),
        prisma.listeningWord.deleteMany(),
        prisma.listeningExercise.deleteMany(),
        prisma.speakingTurn.deleteMany(),
        prisma.speakingSession.deleteMany(),
        prisma.skillLog.deleteMany(),
        prisma.wordSkill.deleteMany(),
        prisma.audioCache.deleteMany(),
        prisma.speechUsage.deleteMany(),
        prisma.testAnswer.deleteMany(),
        prisma.testSession.deleteMany(),
        prisma.storyWord.deleteMany(),
        prisma.story.deleteMany(),
        prisma.reviewLog.deleteMany(),
        prisma.wordForm.deleteMany(),
        prisma.exampleSentence.deleteMany(),
        prisma.wordTag.deleteMany(),
        prisma.meaning.deleteMany(),
        prisma.srsCard.deleteMany(),
        prisma.word.deleteMany(),
        prisma.tag.deleteMany(),
        prisma.studyDay.deleteMany(),
        prisma.dailyWorkflow.deleteMany(),
        prisma.aiCache.deleteMany(),
        prisma.tokenUsage.deleteMany(),
      ])
      return ok({ ok: true })
    }
    if (body.action === "restore" && body.backup) {
      const dest = dbPath()
      const tmp = `${dest}.restore`
      await writeFile(tmp, Buffer.from(body.backup, "base64"))
      await prisma.$disconnect()
      await copyFile(tmp, dest)
      return ok({ ok: true })
    }
    return fail(new Error("Unsupported backup action"))
  } catch (error) {
    return fail(error)
  }
}
