"use client"

import { useRef, useState } from "react"
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
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { LabelField } from "@/components/vocabulary/label-field"
import { api } from "@/lib/client"
import { compressPhoto } from "@/lib/image"
import { parseLabels, readLastLabel, writeLastLabel } from "@/lib/labels"
import type { ImportPreviewRow } from "@/lib/types"

type Preview = {
  rows: ImportPreviewRow[]
  total: number
  duplicates: number
  missingTranslation: number
}

export function ScanDialog({
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
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [previewUrl, setPreviewUrl] = useState<string>()
  const [note, setNote] = useState<string>()
  const [preview, setPreview] = useState<Preview | null>(null)
  const [corrections, setCorrections] = useState<Record<string, { english?: string; skip?: boolean }>>({})
  const [label, setLabel] = useState("")
  const cameraRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function reset() {
    setPreviewUrl(undefined)
    setPreview(null)
    setNote(undefined)
    setCorrections({})
    setProgress(0)
  }

  async function extract(file: File) {
    setBusy(true)
    setProgress(15)
    setPreview(null)
    setNote(undefined)
    try {
      const image = await compressPhoto(file)
      setPreviewUrl(image.previewUrl)
      setProgress(45)
      const result = await api<{ note?: string; found: number; preview: Preview }>("/api/import/image", {
        method: "POST",
        body: JSON.stringify({ mimeType: image.mimeType, data: image.data }),
      })
      setNote(result.note)
      setPreview(result.preview)
      setProgress(100)
      if (!result.preview.total) {
        toast.message(result.note || "No highlighted words were found in that photo.")
      } else {
        toast.success(`${result.preview.total} highlighted word${result.preview.total === 1 ? "" : "s"} ready to save`)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not read the photo")
    } finally {
      setBusy(false)
      setProgress(0)
    }
  }

  async function save() {
    if (!preview) return
    setBusy(true)
    try {
      const labelsToSave = parseLabels(label)
      writeLastLabel(label)
      const result = await api<{ created: number; updated: number; skipped: number }>("/api/import", {
        method: "PUT",
        body: JSON.stringify({ rows: preview.rows, corrections, translateMissing: true, labels: labelsToSave }),
      })
      const summary = [
        result.created ? `${result.created} added` : null,
        result.updated ? `${result.updated} updated` : null,
        result.skipped ? `${result.skipped} already saved` : null,
      ]
        .filter(Boolean)
        .join(" · ")
      toast.success(summary || "Saved to your library")
      setOpen(false)
      reset()
      await onImported()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save words")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) setLabel((current) => current || readLastLabel())
        if (!next) reset()
      }}
    >
      {!controlled ? <DialogTrigger render={<Button variant="outline" />}>From photo</DialogTrigger> : null}
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Scan highlighted words</DialogTitle>
          <DialogDescription>
            Photograph a page with highlighter, pink chips, or other marked words. Only those Turkish items are extracted, translated, and added to your library.
          </DialogDescription>
        </DialogHeader>

        <div
          className="rounded-xl border border-dashed bg-muted/40 p-4 text-center text-sm"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault()
            const file = event.dataTransfer.files[0]
            if (file) void extract(file)
          }}
        >
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="Uploaded page" className="mx-auto max-h-56 rounded-lg object-contain" />
          ) : (
            <p className="text-muted-foreground">Drop a photo here, or use the buttons below.</p>
          )}
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <Button size="sm" disabled={busy} onClick={() => fileRef.current?.click()}>
              Choose photo
            </Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => cameraRef.current?.click()}>
              Take photo
            </Button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void extract(file)
              event.target.value = ""
            }}
          />
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void extract(file)
              event.target.value = ""
            }}
          />
        </div>

        <LabelField value={label} onChange={setLabel} suggestions={labels} />

        {busy && <Progress value={progress || 30} />}
        {note && <p className="text-sm text-muted-foreground">{note}</p>}

        {preview && preview.total > 0 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {preview.total} words · {preview.duplicates} already in your library
            </p>
            <div className="max-h-64 overflow-auto rounded-lg border text-sm">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50 text-left">
                    <th className="p-2">Save</th>
                    <th className="p-2">Turkish</th>
                    <th className="p-2">English</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((row) => {
                    const skip = corrections[row.normalized]?.skip ?? row.action === "skip"
                    return (
                      <tr key={`${row.normalized}-${row.lineNumber}`} className="border-b align-top">
                        <td className="p-2">
                          <input
                            type="checkbox"
                            checked={!skip}
                            onChange={(event) =>
                              setCorrections((current) => ({
                                ...current,
                                [row.normalized]: { ...current[row.normalized], skip: !event.target.checked },
                              }))
                            }
                          />
                        </td>
                        <td className="p-2">
                          <div className="font-medium">{row.turkish}</div>
                          {row.highlightedForm && (
                            <div className="text-xs text-muted-foreground">as {row.highlightedForm}</div>
                          )}
                          {row.context && <div className="mt-1 text-xs text-muted-foreground">{row.context}</div>}
                        </td>
                        <td className="p-2">
                          <Input
                            value={corrections[row.normalized]?.english ?? row.english ?? ""}
                            onChange={(event) =>
                              setCorrections((current) => ({
                                ...current,
                                [row.normalized]: { ...current[row.normalized], english: event.target.value, skip: false },
                              }))
                            }
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <Button disabled={busy} onClick={save}>
              Save to library{parseLabels(label)[0] ? ` as ${parseLabels(label)[0]}` : ""}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
