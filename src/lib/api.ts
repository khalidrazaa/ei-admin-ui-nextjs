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

export type ApiRequestOptions = RequestInit & {
  // Synchronous generation and scraping can opt out with 0.
  timeoutMs?: number;
};

function clearSessionAndReturnToLogin(): Promise<boolean> {
  if (!loginRecovery) {
    loginRecovery = (async () => {
      try {
        await apiFetch("/auth/logout", {
          method: "POST",
          signal: AbortSignal.timeout(5000),
          timeoutMs: 0,
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
  { timeoutMs = 30_000, ...options }: ApiRequestOptions = {}
): Promise<T> {
  const controller = new AbortController();
  const forwardAbort = () => controller.abort(options.signal?.reason);
  if (options.signal?.aborted) forwardAbort();
  else options.signal?.addEventListener("abort", forwardAbort, { once: true });
  let timedOut = false;
  const timeout = timeoutMs > 0 ? setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs) : undefined;

  let res: Response;
  let data: unknown;
  try {
    if (controller.signal.aborted) throw controller.signal.reason;
    res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      credentials: "include",
    });

    if (res.status === 204 || res.status === 205) {
      data = null;
    } else {
      try {
        data = await res.json();
      } catch (error) {
        if (controller.signal.aborted) throw error;
        if (res.ok) {
          throw new ApiError(
            "The API returned an invalid response. Check NEXT_PUBLIC_API_BASE_URL and that the backend is running.",
            res.status,
          );
        }
        data = null;
      }
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (timedOut) {
      throw new ApiError("The API request timed out. Please try again.", 0, error);
    }
    if (options.signal?.aborted) throw options.signal.reason ?? error;
    throw new ApiError(
      "Unable to reach the API. Check that the backend is running and NEXT_PUBLIC_API_BASE_URL is correct.",
      0,
      error,
    );
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
    options.signal?.removeEventListener("abort", forwardAbort);
  }

  if (!res.ok) {
    let message = res.statusText.trim() || `API request failed (HTTP ${res.status}).`;

    if (
      typeof data === "object" &&
      data !== null &&
      "detail" in data &&
      typeof (data as Record<string, unknown>).detail === "string" &&
      ((data as Record<string, unknown>).detail as string).trim()
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
