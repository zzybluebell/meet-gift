// 内存版滑动窗口限流。单实例内强一致，serverless 多实例下"尽力而为"
// （每个 Vercel function instance 独立计数，但能挡住绝大多数恶意/误触发）。
//
// 升级路径：要严格分布式限流时换 @upstash/ratelimit + @upstash/redis，
// 替换 InMemoryStore 为 UpstashStore，调用方不用改。

type Timestamps = number[];

interface RateLimitStore {
  get(key: string): Timestamps;
  set(key: string, ts: Timestamps): void;
  delete(key: string): void;
  entries(): IterableIterator<[string, Timestamps]>;
}

class InMemoryStore implements RateLimitStore {
  private map = new Map<string, Timestamps>();
  get(key: string) { return this.map.get(key) ?? []; }
  set(key: string, ts: Timestamps) { this.map.set(key, ts); }
  delete(key: string) { this.map.delete(key); }
  entries() { return this.map.entries(); }
}

// 全局共享 store（Next.js 同一 function instance 内存活）
const globalForStore = globalThis as unknown as { __rlStore?: InMemoryStore };
const store: RateLimitStore = globalForStore.__rlStore ?? (globalForStore.__rlStore = new InMemoryStore());

export type RateLimitResult = {
  success: boolean;
  limit: number;
  remaining: number;
  resetAt: number; // ms epoch
};

export class RateLimiter {
  constructor(
    public readonly limit: number,
    public readonly windowMs: number,
    private readonly namespace: string
  ) {}

  async check(identifier: string): Promise<RateLimitResult> {
    const now = Date.now();
    const cutoff = now - this.windowMs;
    const key = `${this.namespace}:${identifier}`;

    const existing = store.get(key).filter((t) => t > cutoff);

    if (existing.length >= this.limit) {
      return {
        success: false,
        limit: this.limit,
        remaining: 0,
        resetAt: existing[0] + this.windowMs,
      };
    }

    existing.push(now);
    store.set(key, existing);

    // 1% 概率触发 GC，清理过期 key
    if (Math.random() < 0.01) this.gc(cutoff);

    return {
      success: true,
      limit: this.limit,
      remaining: this.limit - existing.length,
      resetAt: now + this.windowMs,
    };
  }

  private gc(cutoff: number) {
    for (const [k, ts] of store.entries()) {
      const filtered = ts.filter((t) => t > cutoff);
      if (filtered.length === 0) store.delete(k);
      else store.set(k, filtered);
    }
  }
}

// ============== 预设限流器 ==============

// 预约：单用户 10 秒最多 5 次（防双击 + 防脚本刷）
export const claimLimiter = new RateLimiter(5, 10_000, "claim");

// 核销：单 verifier 10 秒最多 30 次（扫码节奏较快，给宽松一点）
export const verifyLimiter = new RateLimiter(30, 10_000, "verify");

// 登录：单 IP 1 分钟最多 10 次（防工号枚举）
export const loginLimiter = new RateLimiter(10, 60_000, "login");

// ============== 辅助 ==============

/**
 * 从 Request 提取 IP（用于匿名接口的限流 key）
 * Vercel/CDN 链路下 x-forwarded-for 头有真实 IP
 */
export function getClientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/**
 * 把限流结果转 429 响应（如果被限）；否则返回 null
 */
export function rateLimitResponse(result: RateLimitResult) {
  if (result.success) return null;
  const retryAfterSec = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000));
  return new Response(
    JSON.stringify({ error: `操作太频繁，请 ${retryAfterSec} 秒后再试` }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfterSec),
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
      },
    }
  );
}
