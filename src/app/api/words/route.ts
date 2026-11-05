import { ensureDb } from "@/lib/prisma"
import { fail, ok, readBody } from "@/lib/api"
import { listWords } from "@/lib/repos/words"

export async function GET(request: Request) {
  try {
    await ensureDb()
    const url = new URL(request.url)
    const result = await listWords({
      q: url.searchParams.get("q") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      tag: url.searchParams.get("tag") ?? undefined,
      sort: url.searchParams.get("sort") ?? undefined,
      take: Number(url.searchParams.get("take") ?? 300),
      skip: Number(url.searchParams.get("skip") ?? 0),
    })
    return ok(result)
  } catch (error) {
    return fail(error)
  }
}

export async function POST(request: Request) {
  try {
    await ensureDb()
    const body = await readBody<{ turkish: string; english?: string; partOfSpeech?: string }>(request)
    if (!body.turkish?.trim()) return fail(new Error("Turkish word is required"))
    const { commitImport } = await import("@/lib/repos/words")
    const { normalizeTurkish } = await import("@/lib/turkish")
    const { guessPartOfSpeech } = await import("@/lib/import/parse")
    const turkish = body.turkish.trim()
    const result = await commitImport([
      {
        turkish,
        english: body.english?.trim(),
        partOfSpeech: (body.partOfSpeech as never) ?? guessPartOfSpeech(turkish),
        lineNumber: 1,
        normalized: normalizeTurkish(turkish),
        duplicateInFile: false,
        existingUserEdited: false,
        action: body.english?.trim() ? "create" : "needs-translation",
      },
    ])
    return ok(result)
  } catch (error) {
    return fail(error)
  }
}
