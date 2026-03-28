import { PaymentDomain } from "../domain/payment.js";
import { IPaymentsCachePort } from "./ports/outbound/cache/cache.js";
import { IPaymentsRepositoryReadPort } from "./ports/outbound/database/database-read.js";
import { IPaymentsTelemetryPort } from "./ports/outbound/telemetry/telemetry.js";

export class FindPaymentByIdempotencyUseCase {
  constructor(
    private readonly readRepository: IPaymentsRepositoryReadPort,
    private readonly cache: IPaymentsCachePort,
    private readonly telemetry: IPaymentsTelemetryPort,
  ) {}

  async execute(idempotencyKey: string): Promise<PaymentDomain | null> {
    return this.telemetry.span("payments.findByIdempotency", async () => {
      const cacheName = `paymentsIdempotencyKey:${idempotencyKey}`
      const cached = await this.cache.get(cacheName);

      if (cached) {
        return cached;
      }

      const payment = await this.readRepository.findByIdempotencyKey(idempotencyKey);

      if (payment) {
        await this.cache.set(cacheName, payment);
      }
      
      return payment;
    });
  }
}