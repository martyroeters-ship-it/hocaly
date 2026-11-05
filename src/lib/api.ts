import { NextResponse } from "next/server"
import { AiResponseError, AiUnavailableError, GeminiQuotaError } from "@/lib/ai/provider"
import { SpeechUnavailableError } from "@/lib/speech/providers"

export class RequestError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message)
    this.name = "RequestError"
  }
}

export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data, { status })
}

export function fail(error: unknown, fallback = "Something went wrong") {
  const message = error instanceof Error ? error.message : fallback
  const status =
    error instanceof RequestError
      ? error.status
      : error instanceof GeminiQuotaError
        ? 429
        : error instanceof AiUnavailableError || error instanceof SpeechUnavailableError
          ? 400
        : error instanceof AiResponseError
          ? 422
          : 500
  return NextResponse.json({ error: message }, { status })
}

export async function readBody<T>(request: Request): Promise<T> {
  return (await request.json()) as T
}
