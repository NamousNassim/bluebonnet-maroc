import { StartEntrepriseError } from "./errors";

export interface ClientCredentials { tokenUrl: string; clientId: string; clientSecret: string; timeoutMs: number }

/**
 * OAuth2 client-credentials token cache. Concurrent callers share one in-flight request; a token is
 * refreshed 30 s before expiry, or immediately after StartEntreprise answers 401.
 */
export class TokenProvider {
  private token?: { value: string; expiresAt: number };
  private pending?: Promise<string>;

  constructor(private readonly credentials: ClientCredentials, private readonly fetcher: typeof fetch = fetch,
      private readonly now: () => number = Date.now) {}

  async get(): Promise<string> {
    if (this.token && this.token.expiresAt - 30_000 > this.now()) return this.token.value;
    this.pending ??= this.fetchToken().finally(() => { this.pending = undefined; });
    return this.pending;
  }

  invalidate(): void { this.token = undefined; }

  private async fetchToken(): Promise<string> {
    const body = new URLSearchParams({ grant_type: "client_credentials", client_id: this.credentials.clientId, client_secret: this.credentials.clientSecret });
    let response: Response;
    try {
      response = await this.fetcher(this.credentials.tokenUrl, {
        method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
        body, signal: AbortSignal.timeout(this.credentials.timeoutMs),
      });
    } catch {
      throw new StartEntrepriseError("AUTH_UNAVAILABLE", undefined, true, "Identity provider unreachable");
    }
    if (response.status === 400 || response.status === 401) {
      throw new StartEntrepriseError("AUTH_REJECTED", response.status, false, "Client credentials rejected");
    }
    if (!response.ok) throw new StartEntrepriseError("AUTH_UNAVAILABLE", response.status, true, "Identity provider error");
    const json = (await response.json()) as { access_token?: string; expires_in?: number };
    if (!json.access_token) throw new StartEntrepriseError("AUTH_UNAVAILABLE", response.status, true, "No access token returned");
    this.token = { value: json.access_token, expiresAt: this.now() + Math.max(30, json.expires_in ?? 60) * 1000 };
    return json.access_token;
  }
}
