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
let loginRecovery: Promise<boolean> | undefined;

function clearSessionAndReturnToLogin(): Promise<boolean> {
  if (!loginRecovery) {
    loginRecovery = (async () => {
      try {
        await apiFetch("/auth/logout", {
          method: "POST",
          signal: AbortSignal.timeout(5000),
        });
        window.location.replace("/login");
        return true;
      } catch {
        return false;
      }
    })();
  }

  return loginRecovery;
}

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
    credentials: "include",
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

    if (
      res.status === 401 &&
      !/^\/auth(?:\/|\?|$)/.test(endpoint) &&
      typeof window !== "undefined" &&
      window.location.pathname !== "/login"
    ) {
      const cleared = await clearSessionAndReturnToLogin();
      if (!cleared) {
        message +=
          " Your session could not be cleared. Reload and try signing out, or clear this site's cookies before signing in again.";
      }
    }

    throw new ApiError(message, res.status, data);
  }

  return data as T;
}
