import { RequestError } from "@/lib/api"
import { FEEDBACK_TO, FEEDBACK_TYPE_LABELS, type FeedbackType } from "@/lib/feedback"

function env(name: string) {
  return process.env[name]?.trim() || ""
}

export function mailConfigured() {
  return Boolean(env("RESEND_API_KEY") || smtpOptions())
}

function smtpOptions() {
  const gmailUser = env("GMAIL_USER")
  const gmailPass = env("GMAIL_APP_PASSWORD")
  if (gmailUser && gmailPass) {
    return {
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      user: gmailUser,
      pass: gmailPass,
      from: env("FEEDBACK_FROM") || gmailUser,
    }
  }

  const host = env("SMTP_HOST")
  const user = env("SMTP_USER")
  const pass = env("SMTP_PASS")
  if (!host || !user || !pass) return null

  const port = Number(env("SMTP_PORT") || "465")
  const secure = env("SMTP_SECURE") ? env("SMTP_SECURE") !== "false" : port === 465
  return {
    host,
    port: Number.isFinite(port) ? port : 465,
    secure,
    user,
    pass,
    from: env("FEEDBACK_FROM") || user,
  }
}

async function sendWithResend(to: string, subject: string, text: string) {
  const from = env("FEEDBACK_FROM") || env("RESEND_FROM") || "Kelime <beth.t@example.com>"
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env("RESEND_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: [to], subject, text }),
  })
  if (!response.ok) {
    const detail = await response.text().catch(() => "")
    console.error("Resend rejected the feedback email", response.status, detail.slice(0, 400))
    throw new RequestError("Could not send that message. Try again in a moment.", 502)
  }
}

async function sendWithSmtp(to: string, subject: string, text: string) {
  const options = smtpOptions()
  if (!options) throw new RequestError("Feedback email isn't configured on the server yet.", 503)

  const { createTransport } = await import("nodemailer")
  const transporter = createTransport({
    host: options.host,
    port: options.port,
    secure: options.secure,
    auth: { user: options.user, pass: options.pass },
  })
  try {
    await transporter.sendMail({
      from: `Kelime <${options.from}>`,
      to,
      subject,
      text,
    })
  } catch (error) {
    console.error("SMTP rejected the feedback email", error)
    throw new RequestError("Could not send that message. Try again in a moment.", 502)
  }
}

export async function sendFeedbackEmail(type: FeedbackType, message: string) {
  const to = env("FEEDBACK_TO") || FEEDBACK_TO
  const subject = `[Kelime] ${FEEDBACK_TYPE_LABELS[type]}`
  const text = `Type: ${FEEDBACK_TYPE_LABELS[type]}\n\n${message}\n`

  if (env("RESEND_API_KEY")) {
    await sendWithResend(to, subject, text)
    return
  }
  if (smtpOptions()) {
    await sendWithSmtp(to, subject, text)
    return
  }

  throw new RequestError("Feedback email isn't configured on the server yet.", 503)
}
