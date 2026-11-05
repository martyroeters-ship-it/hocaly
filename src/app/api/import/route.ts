import { completeJson } from "@/lib/ai/provider"
import { translationBatchSchema } from "@/lib/ai/schemas"
import { translationPrompt } from "@/lib/ai/prompts"
import { fail, ok, readBody } from "@/lib/api"
import { mergeLabels, parseLabels } from "@/lib/labels"
import { ensureDb } from "@/lib/prisma"
import { commitImport, previewImport } from "@/lib/repos/words"
import { normalizeTurkish } from "@/lib/turkish"
import type { ImportPreviewRow } from "@/lib/types"

function applyCorrections(
  rows: ImportPreviewRow[],
  corrections: Record<string, { english?: string; partOfSpeech?: string; skip?: boolean }>,
): ImportPreviewRow[] {
  return rows.map((row) => {
    const correction = corrections[row.normalized]
    if (!correction) return row
    if (correction.skip) return { ...row, action: "skip", omitLabels: true }
    const english = correction.english?.trim() || row.english
    const action: ImportPreviewRow["action"] = english
      ? row.existingId
        ? "add-meaning"
        : "create"
      : "needs-translation"
    return {
      ...row,
      english,
      partOfSpeech: (correction.partOfSpeech as ImportPreviewRow["partOfSpeech"]) ?? row.partOfSpeech,
      action,
    }
  })
}

async function translateMissing(rows: ImportPreviewRow[]) {
  const missing = rows.filter((row) => row.action === "needs-translation")
  const batchSize = 20
  for (let i = 0; i < missing.length; i += batchSize) {
    const slice = missing.slice(i, i + batchSize)
    const prompt = translationPrompt(slice.map((row) => row.turkish))
    const result = await completeJson({
      kind: "translate",
      schema: translationBatchSchema,
      system: prompt.system,
      user: prompt.user,
    })
    const byNorm = new Map(
      result.items.map((item) => [normalizeTurkish(item.turkish), item]),
    )
    for (const row of slice) {
      const item = byNorm.get(row.normalized)
      if (!item?.meanings?.[0]) continue
      row.english = item.meanings[0]
      row.extraMeanings = item.meanings.slice(1)
      row.partOfSpeech = item.partOfSpeech ?? row.partOfSpeech
      row.cefrLevel = item.cefrLevel ?? row.cefrLevel
      row.action = "create"
    }
  }
  return rows
}

export async function POST(request: Request) {
  try {
    await ensureDb()
    const body = await readBody<{ text: string; filename?: string }>(request)
    return ok(await previewImport(body.text ?? "", body.filename))
  } catch (error) {
    return fail(error)
  }
}

export async function PUT(request: Request) {
  try {
    await ensureDb()
    const body = await readBody<{
      text?: string
      filename?: string
      rows?: ImportPreviewRow[]
      corrections?: Record<string, { english?: string; partOfSpeech?: string; skip?: boolean }>
      translateMissing?: boolean
      labels?: string | string[]
    }>(request)
    const preview = body.rows?.length
      ? { rows: body.rows }
      : await previewImport(body.text ?? "", body.filename)
    const labels = parseLabels(body.labels)
    let rows = applyCorrections(preview.rows, body.corrections ?? {}).map((row) =>
      labels.length ? { ...row, tags: mergeLabels(row.tags, labels) } : row,
    )
    if (body.translateMissing) {
      rows = await translateMissing(rows)
    }
    const result = await commitImport(rows)
    return ok({ ...result, remainingWithoutEnglish: rows.filter((row) => !row.english && row.action !== "skip").length })
  } catch (error) {
    return fail(error)
  }
}
