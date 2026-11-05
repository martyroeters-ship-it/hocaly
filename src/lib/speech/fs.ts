import { createHash } from "node:crypto"
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises"
import path from "node:path"

export function audioDir() {
  return path.join(process.cwd(), "data", "audio")
}

export function recordingDir() {
  return path.join(process.cwd(), "data", "recordings")
}

export async function ensureSpeechDirs() {
  await mkdir(audioDir(), { recursive: true })
  await mkdir(recordingDir(), { recursive: true })
}

export function ttsCacheKey(text: string, provider: string, model: string, voice: string) {
  return createHash("sha256").update(`tts:${provider}:${model}:${voice}:${text}`).digest("hex")
}

export function audioPath(key: string, ext = "mp3") {
  return path.join(audioDir(), `${key}.${ext}`)
}

export function recordingPath(key: string, ext = "webm") {
  return path.join(recordingDir(), `${key}.${ext}`)
}

export async function writeAudioFile(filePath: string, buffer: Buffer) {
  await ensureSpeechDirs()
  await writeFile(filePath, buffer)
}

export async function readAudioFile(filePath: string) {
  return readFile(filePath)
}

export async function deleteFileIfPresent(filePath: string) {
  try {
    await unlink(filePath)
  } catch {
    /* already gone */
  }
}
