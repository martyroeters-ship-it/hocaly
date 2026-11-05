import { fail, ok, readBody, RequestError } from "@/lib/api"
import { parseFeedback } from "@/lib/feedback"
import { sendFeedbackEmail } from "@/lib/mail"

export async function POST(request: Request) {
  try {
    const body = await readBody<{ type?: string; message?: string }>(request).catch(() => {
      throw new RequestError("Invalid request.")
    })
    const { type, message } = parseFeedback(body)
    await sendFeedbackEmail(type, message)
    return ok({ ok: true })
  } catch (error) {
    return fail(error)
  }
}
