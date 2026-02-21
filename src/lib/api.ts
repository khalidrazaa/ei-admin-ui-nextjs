export class ApiError extends Error {
  status: number;
  info?: unknown;

  constructor(message: string, status: number, info?: unknown) {
    super(message);
    this.status = status;
    this.info = info;
  }
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "";

export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    credentials: "include", // ✅ send cookies (important for auth)
  });

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    let message = res.statusText;

    if (
      typeof data === "object" &&
      data !== null &&
      "detail" in data &&
      typeof (data as Record<string, unknown>).detail === "string"
    ) {
      message = (data as Record<string, unknown>).detail as string;
    }

    throw new ApiError(message, res.status, data);
  }

  return data as T;
}