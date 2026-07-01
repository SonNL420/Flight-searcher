import { config } from "./config";

/**
 * Politeness layer for outbound Amadeus API calls:
 *  - strictly serialized (one request in flight at a time)
 *  - configurable delay + random jitter between requests
 *  - exponential backoff with retries on 429 / 5xx (honors Retry-After)
 *  - hard daily request budget so a misconfigured route list can't burn quota
 */

const MAX_RETRIES = 4;

let queue: Promise<unknown> = Promise.resolve();
let lastRequestAt = 0;

let budgetDay = "";
let budgetUsed = 0;

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export function remainingDailyBudget(): number {
  if (budgetDay !== todayUtc()) return config.politeness.dailyRequestBudget;
  return Math.max(0, config.politeness.dailyRequestBudget - budgetUsed);
}

function takeBudget(): void {
  const day = todayUtc();
  if (budgetDay !== day) {
    budgetDay = day;
    budgetUsed = 0;
  }
  if (budgetUsed >= config.politeness.dailyRequestBudget) {
    throw new BudgetExceededError(
      `Daily request budget of ${config.politeness.dailyRequestBudget} exhausted; try again tomorrow or raise DAILY_REQUEST_BUDGET`
    );
  }
  budgetUsed += 1;
}

export class BudgetExceededError extends Error {}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function politePause(): Promise<void> {
  const jitter = Math.random() * 400;
  const wait = lastRequestAt + config.politeness.requestDelayMs + jitter - Date.now();
  if (wait > 0) await sleep(wait);
  lastRequestAt = Date.now();
}

function retryDelayMs(attempt: number, res?: Response): number {
  const retryAfter = res?.headers.get("retry-after");
  if (retryAfter) {
    const secs = Number(retryAfter);
    if (Number.isFinite(secs) && secs > 0) return secs * 1000;
  }
  return 1000 * 2 ** attempt + Math.random() * 500;
}

/**
 * Perform a fetch through the serialized, budgeted, retrying queue.
 * Returns the first response that is not 429/5xx (which may still be a 4xx
 * error the caller must handle).
 */
export function politeFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const run = queue.then(async () => {
    takeBudget();
    for (let attempt = 0; ; attempt++) {
      await politePause();
      let res: Response | undefined;
      let networkError: unknown;
      try {
        res = await fetch(url, {
          ...init,
          headers: {
            "User-Agent": config.politeness.userAgent,
            ...(init.headers ?? {}),
          },
        });
      } catch (err) {
        networkError = err;
      }
      const retryable = !res || res.status === 429 || res.status >= 500;
      if (!retryable) return res!;
      if (attempt >= MAX_RETRIES) {
        if (res) return res;
        throw networkError instanceof Error
          ? networkError
          : new Error(`Network error calling ${url}`);
      }
      await sleep(retryDelayMs(attempt, res));
    }
  });
  // Keep the chain alive even when a request ultimately fails.
  queue = run.catch(() => {});
  return run;
}
