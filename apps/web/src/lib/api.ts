export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}

const NO_RETRY = new Set(["/auth/refresh", "/auth/logout"]);
let refreshing: Promise<boolean> | null = null;

/** One refresh at a time; concurrent 401s wait on the same call. */
function refreshSession() {
  refreshing ??= fetch("/api/auth/refresh", { method: "POST", credentials: "same-origin" })
    .then((r) => r.ok)
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  const send = () =>
    fetch(`/api${path}`, {
      credentials: "same-origin",
      ...rest,
      headers: json !== undefined ? { "Content-Type": "application/json", ...headers } : headers,
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    });

  let res = await send();
  if (res.status === 401 && !NO_RETRY.has(path) && (await refreshSession())) res = await send();

  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, body.error ?? "request_failed");
  return body as T;
}
