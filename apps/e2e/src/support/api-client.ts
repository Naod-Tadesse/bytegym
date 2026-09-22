import type { APIRequestContext, APIResponse } from '@playwright/test';
import { API_URL } from './env';

export interface Tokens {
  accessToken: string;
  refreshToken: string;
}

export interface Credentials {
  phone: string;
  password: string;
}

export async function login(
  ctx: APIRequestContext,
  creds: Credentials,
): Promise<Tokens> {
  const res = await ctx.post(`${API_URL}/api/auth/login`, { data: creds });
  if (res.status() !== 200) {
    throw new Error(
      `login failed for ${creds.phone}: ${res.status()} ${await res.text()}`,
    );
  }
  return (await res.json()) as Tokens;
}

/**
 * A thin authenticated wrapper over Playwright's request context.
 *
 * Every method returns the raw APIResponse so specs can assert on status codes
 * and error bodies; `json()` is the sugar for the happy path. Nothing here
 * throws on a non-2xx — that is the point, most of the suite is about the
 * unhappy paths.
 */
export class Api {
  constructor(
    readonly ctx: APIRequestContext,
    readonly token: string,
  ) {}

  private headers(): Record<string, string> {
    return { Authorization: `Bearer ${this.token}` };
  }

  private url(path: string): string {
    return `${API_URL}/api${path}`;
  }

  get(path: string, params?: Record<string, string | number | boolean>) {
    return this.ctx.get(this.url(path), { headers: this.headers(), params });
  }
  post(path: string, data?: unknown) {
    return this.ctx.post(this.url(path), { headers: this.headers(), data });
  }
  patch(path: string, data?: unknown) {
    return this.ctx.patch(this.url(path), { headers: this.headers(), data });
  }
  put(path: string, data?: unknown) {
    return this.ctx.put(this.url(path), { headers: this.headers(), data });
  }
  delete(path: string, data?: unknown) {
    return this.ctx.delete(this.url(path), { headers: this.headers(), data });
  }

  /** Asserts 2xx and returns the parsed body — for arrange steps only. */
  async json<T>(res: Promise<APIResponse> | APIResponse): Promise<T> {
    const r = await res;
    if (r.status() >= 300) {
      throw new Error(`${r.url()} -> ${r.status()}: ${await r.text()}`);
    }
    return (await r.json()) as T;
  }
}

export interface Paginated<T> {
  data: T[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}
