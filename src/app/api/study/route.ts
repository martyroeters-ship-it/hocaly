import { fail, ok, readBody } from "@/lib/api"
import { ensureDb } from "@/lib/prisma"
import { addStudyTime, saveWorkflow, studyQueue } from "@/lib/repos/reviews"

export async function GET() {
  try {
    await ensureDb()
    return ok(await studyQueue())
  } catch (error) {
    return fail(error)
  }
}

export async function POST(request: Request) {
  try {
    await ensureDb()
    const body = await readBody<{
      seconds?: number
      workflow?: {
        reviewsDone?: boolean
        newDone?: boolean
        sentencesDone?: boolean
        testDone?: boolean
        storyDone?: boolean
        pausedJson?: string | null
      }
    }>(request)
    if (body.seconds) await addStudyTime(body.seconds)
    if (body.workflow) await saveWorkflow(body.workflow)
    return ok(await studyQueue())
  } catch (error) {
    return fail(error)
  }
}
