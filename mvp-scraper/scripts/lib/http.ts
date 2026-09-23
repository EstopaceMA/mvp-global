import { setTimeout as delay } from "node:timers/promises";

export class HttpError extends Error {
  constructor(public status: number, url: string) {
    super(`HTTP ${status} from ${url}${status === 401 || status === 403 ? "; access denied, stopping without bypassing authentication" : ""}`);
  }
}

export function retryDelay(value: string | null, fallback: number, now = Date.now()): number {
  if (!value) return fallback;
  const seconds = Number(value);
  const duration = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(value) - now;
  return Number.isFinite(duration) ? Math.max(fallback, duration) : fallback;
}

export class HttpClient {
  private lastRequest = 0;
  private blockedUntil = 0;
  private gate: Promise<void> = Promise.resolve();
  constructor(
    private intervalMs = 1000,
    private fetchFn: typeof fetch = fetch,
    private sleep: (ms: number) => Promise<unknown> = delay,
    private log: (message: string) => void = console.error,
    private now: () => number = Date.now,
  ) {}

  private async startRequest(start: () => Promise<Response>): Promise<Response> {
    let request: Promise<Response> | undefined;
    const turn = this.gate.then(async () => {
      await this.sleep(Math.max(0, this.lastRequest + this.intervalMs - this.now(), this.blockedUntil - this.now()));
      // Another in-flight response may extend Retry-After while this slot waits.
      while (this.blockedUntil > this.now()) await this.sleep(this.blockedUntil - this.now());
      this.lastRequest = this.now();
      request = start();
    });
    this.gate = turn.catch(() => {});
    await turn;
    return request!;
  }

  async text(url: string, init: RequestInit = {}): Promise<string> {
    for (let attempt = 0; attempt <= 3; attempt++) {
      let response: Response;
      let body: string;
      try {
        response = await this.startRequest(() => this.fetchFn(url, {
          ...init, redirect: "error", signal: AbortSignal.timeout(30_000),
          headers: {
            "User-Agent": "MvpGlobalDirectoryScraper/0.1 (public directory research)",
            "Accept": "application/json, text/plain, */*",
            ...init.headers,
          },
        }));
        body = await response.text();
      } catch (error) {
        if (attempt === 3) throw new Error(`Request failed for ${url}`, { cause: error });
        this.log(`Network error; retry ${attempt + 1}/3 for ${url}`);
        await this.sleep(2000 * 2 ** attempt);
        continue;
      }
      if (response.ok) return body;
      if ((response.status === 429 || response.status >= 500) && attempt < 3) {
        const wait = retryDelay(response.headers.get("retry-after"), 2000 * 2 ** attempt, this.now());
        if (wait > 120_000) throw new Error(`Server requested a ${Math.ceil(wait / 1000)}s pause. Resume later; checkpoint retained.`);
        this.log(`HTTP ${response.status}; retry ${attempt + 1}/3 in ${Math.ceil(wait / 1000)}s`);
        this.blockedUntil = Math.max(this.blockedUntil, this.now() + wait);
        await this.sleep(wait);
        continue;
      }
      throw new HttpError(response.status, url);
    }
    throw new Error("Retry limit exhausted.");
  }

  async json(url: string, payload?: unknown): Promise<unknown> {
    const body = await this.text(url, payload === undefined ? {} : {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
    });
    try { return JSON.parse(body); }
    catch { throw new Error(`Expected JSON from ${url}; refusing to export an HTML error page or empty response.`); }
  }
}
