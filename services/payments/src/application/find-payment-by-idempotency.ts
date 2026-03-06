import { Payment } from "../domain/payment.js";
import { PaymentCachePort, PaymentRepositoryPort, TelemetryPort } from "./ports.js";

// Is this use case attend to hexagonal architecture? Even this use case is not used in inbound adapter, it is used in CreatePaymentUseCase. So, I think this use case is attend to hexagonal architecture.
export class FindPaymentByIdempotencyUseCase {
  constructor(
    private readonly repository: PaymentRepositoryPort,
    private readonly cache: PaymentCachePort,
    private readonly telemetry: TelemetryPort,
  ) {}

  async execute(idempotencyKey: string): Promise<Payment | null> {
    return this.telemetry.span("payments.findByIdempotency", async () => {
      const cached = await this.cache.get(`idempotency:${idempotencyKey}`);

      if (cached) {
          return cached;
      }

      const payment = await this.repository.findByIdempotencyKey(idempotencyKey);

      if (payment) {
          await this.cache.set(`idempotency:${idempotencyKey}`, payment, 60 * 60);
      }

      return payment;
    });
  }
}