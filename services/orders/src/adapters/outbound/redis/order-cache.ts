import type Redis from "ioredis";
import type { Order } from "../../../domain/order.js";
import type { OrderCachePort } from "../../../application/ports.js";

export class RedisOrderCache implements OrderCachePort {
  constructor(private readonly redis: Redis) {}

  async get(id: string): Promise<Order | null> {
    const raw = await this.redis.get(`order:${id}`);
    return raw ? (JSON.parse(raw) as Order) : null;
  }

  async set(order: Order): Promise<void> {
    await this.redis.set(`order:${order.id}`, JSON.stringify(order), "EX", 60);
  }
}
