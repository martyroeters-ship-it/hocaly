"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { LabelField } from "@/components/vocabulary/label-field"
import { api } from "@/lib/client"
import { parseLabels, readLastLabel, writeLastLabel } from "@/lib/labels"
import type { ImportPreviewRow } from "@/lib/types"

export function ImportDialog({
  onImported,
  labels = [],
  open: openProp,
  onOpenChange,
}: {
  onImported: () => Promise<void> | void
  labels?: string[]
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const controlled = openProp !== undefined
  const open = controlled ? openProp : uncontrolledOpen
  function setOpen(next: boolean) {
    if (!controlled) setUncontrolledOpen(next)
    onOpenChange?.(next)
  }
  const [text, setText] = useState("")
  const [filename, setFilename] = useState<string>()
  const [preview, setPreview] = useState<{
    rows: ImportPreviewRow[]
    total: number
    duplicates: number
    missingTranslation: number
  } | null>(null)
  const [corrections, setCorrections] = useState<Record<string, { english?: string; skip?: boolean }>>({})
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [label, setLabel] = useState("")

  async function runPreview() {
    setBusy(true)
    try {
      const data = await api<NonNullable<typeof preview>>("/api/import", {
        method: "POST",
        body: JSON.stringify({ text, filename }),
      })
      setPreview(data)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not parse import")
    } finally {
      setBusy(false)
    }
  }

  async function commit(translateMissing: boolean) {
    setBusy(true)
    setProgress(20)
    try {
      writeLastLabel(label)
      const result = await api<{ created: number; updated: number; skipped: number }>("/api/import", {
        method: "PUT",
        body: JSON.stringify({ text, filename, corrections, translateMissing, labels: parseLabels(label) }),
      })
      setProgress(100)
      toast.success(`Imported ${result.created} words (${result.updated} updated, ${result.skipped} skipped)`)
      setOpen(false)
      setPreview(null)
      setText("")
      await onImported()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Import failed")
    } finally {
      setBusy(false)
      setProgress(0)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) setLabel((current) => current || readLastLabel())
      }}
    >
      {!controlled ? <DialogTrigger render={<Button />}>Import</DialogTrigger> : null}
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Bulk import</DialogTitle>
          <DialogDescription>
            One word per line, Turkish–English pairs, CSV, or JSON. Existing user-edited translations are never replaced.
          </DialogDescription>
        </DialogHeader>
        <Input
          type="file"
          accept=".txt,.csv,.tsv,.json"
          onChange={async (event) => {
            const file = event.target.files?.[0]
            if (!file) return
            setFilename(file.name)
            setText(await file.text())
          }}
        />
        <Textarea
          rows={8}
          placeholder={"gelmek\tto come\nanlamak; to understand\narkadaş, friend"}
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
        <LabelField value={label} onChange={setLabel} suggestions={labels} />
        <div className="flex flex-wrap gap-2">
          <Button disabled={busy || !text.trim()} onClick={runPreview}>
            Preview
          </Button>
          {preview && (
            <>
              <Button disabled={busy} onClick={() => commit(false)}>
                Import as-is
              </Button>
              <Button disabled={busy} variant="outline" onClick={() => commit(true)}>
                Translate missing with AI
              </Button>
            </>
          )}
        </div>
        {busy && progress > 0 && <Progress value={progress} />}
        {preview && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {preview.total} rows · {preview.duplicates} skipped duplicates · {preview.missingTranslation} need translation
            </p>
            <div className="max-h-64 overflow-auto rounded-lg border text-sm">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50 text-left">
                    <th className="p-2">Turkish</th>
                    <th className="p-2">English</th>
                    <th className="p-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.slice(0, 200).map((row) => (
                    <tr key={`${row.normalized}-${row.lineNumber}`} className="border-b">
                      <td className="p-2">{row.turkish}</td>
                      <td className="p-2">
                        <Input
                          value={corrections[row.normalized]?.english ?? row.english ?? ""}
                          onChange={(event) =>
                            setCorrections((current) => ({
                              ...current,
                              [row.normalized]: { ...current[row.normalized], english: event.target.value },
                            }))
                          }
                        />
                      </td>
                      <td className="p-2 text-muted-foreground">{row.action}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
