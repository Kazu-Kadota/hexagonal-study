import { Redis } from "ioredis";
import { IPaymentsCachePort } from "../../../../application/ports/outbound/cache/cache.js";
import { PaymentDTO } from "../../../../domain/payment.js";

export class RedisPaymentCache implements IPaymentsCachePort {
  constructor(private readonly redis: Redis) {}

  async get(name: string): Promise<PaymentDTO | null> {
    const raw = await this.redis.get(name);
    return raw ? (JSON.parse(raw) as PaymentDTO) : null;
  }

  async set(name: string, payment: PaymentDTO): Promise<void> {
    await this.redis.set(name, JSON.stringify(payment), "EX", 60);
  }

  async delete(id: string): Promise<void> {
    await this.redis.del(`payment:${id}`);
  }
}
