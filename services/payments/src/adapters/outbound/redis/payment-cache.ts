import type Redis from "ioredis";
import { PaymentCachePort } from "../../../application/ports.js";

export class RedisPaymentCache implements PaymentCachePort {
  constructor(private readonly redis: Redis.Redis) {}

  async get<Payment>(id: string) {
    const raw = await this.redis.get(`payment:${id}`);
    return raw ? (JSON.parse(raw) as Payment) : null;
  }

  async set<Payment>(id: string, payment: Payment, ttlSeconds = 60 * 60) {
    await this.redis.set(`payment:${id}`, JSON.stringify(payment), "EX", ttlSeconds);
  }

  async delete(id: string) {
    const raw = await this.redis.get(`payment:${id}`);

    if (!raw) {
      return;
    }

    await this.redis.del(raw);
  }
}
