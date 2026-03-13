import { Redis } from "ioredis";
import { IOrdersCachePort } from "../../../../application/ports/outbound/cache/cache.js";
import { OrderDTO } from "../../../../domain/order.js";

export class RedisOrderCache implements IOrdersCachePort {
  constructor(private readonly redis: Redis) {}

  async get(id: string): Promise<OrderDTO | null> {
    const raw = await this.redis.get(`order:${id}`);
    return raw ? (JSON.parse(raw) as OrderDTO) : null;
  }

  async set(order: OrderDTO): Promise<void> {
    await this.redis.set(`order:${order.id}`, JSON.stringify(order), "EX", 60);
  }

  async delete(id: string): Promise<void> {
    await this.redis.del(`order:${id}`);
  }
}
