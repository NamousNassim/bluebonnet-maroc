import { randomUUID } from "node:crypto";
import { TokenProvider } from "./auth";
import { StartEntrepriseError } from "./errors";

export interface RequestOptions { method: "GET" | "POST"; path: string; body?: unknown; requestId?: string; retryable: boolean }

/**
 * Authenticated JSON client for the public API. Rules:
 * - 401 → drop the token and retry once;
 * - timeouts, network errors and 5xx → retry once, only for requests declared retryable
 *   (reads, and reservation commands that StartEntreprise makes idempotent);
 * - 403 → configuration problem, never retried; 429 → surfaced with Retry-After.
 */
export class StartEntrepriseClient {
  constructor(private readonly baseUrl: string, private readonly tokens: TokenProvider, private readonly timeoutMs: number,
      private readonly fetcher: typeof fetch = fetch) {}

  async request<T>(options: RequestOptions): Promise<T> {
    const requestId = options.requestId ?? randomUUID();
    let refreshed = false;
    for (let attempt = 0; ; attempt++) {
      let response: Response;
      try {
        response = await this.fetcher(`${this.baseUrl.replace(/\/$/, "")}${options.path}`, {
          method: options.method,
          headers: {
            Authorization: `Bearer ${await this.tokens.get()}`,
            Accept: "application/json",
            "X-Request-Id": requestId,
            ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
          },
          body: options.body === undefined ? undefined : JSON.stringify(options.body),
          signal: AbortSignal.timeout(this.timeoutMs),
        });
      } catch (error) {
        if (error instanceof StartEntrepriseError) throw error;
        if (options.retryable && attempt === 0) continue;
        throw new StartEntrepriseError("UNAVAILABLE", undefined, true, "StartEntreprise unreachable or timed out");
      }
      if (response.status === 401 && !refreshed) {
        refreshed = true;
        this.tokens.invalidate();
        attempt--;
        continue;
      }
      if (response.ok) return (await response.json()) as T;
      const failure = await toError(response);
      if (failure.retryable && failure.httpStatus !== 429 && options.retryable && attempt === 0) continue;
      throw failure;
    }
  }
}

async function toError(response: Response): Promise<StartEntrepriseError> {
  let code = `HTTP_${response.status}`;
  let detail = response.statusText;
  try {
    const problem = (await response.json()) as { code?: string; detail?: string };
    if (problem.code) code = problem.code;
    if (problem.detail) detail = problem.detail;
  } catch { /* non-JSON body from a proxy: keep the HTTP classification */ }
  if (response.status === 429) {
    const retryAfter = Number(response.headers.get("Retry-After"));
    return new StartEntrepriseError(code === `HTTP_429` ? "RATE_LIMITED" : code, 429, true, detail, Number.isFinite(retryAfter) ? retryAfter : undefined);
  }
  if (response.status === 401) return new StartEntrepriseError("AUTH_REJECTED", 401, false, detail);
  return new StartEntrepriseError(code, response.status, response.status >= 500, detail);
}
