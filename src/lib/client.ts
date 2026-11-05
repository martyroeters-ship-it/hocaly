export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message)
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  })
  const data = (await response.json().catch(() => ({}))) as { error?: string } & T
  if (!response.ok) {
    throw new ApiError(data.error || `Request failed (${response.status})`, response.status)
  }
  return data
}
