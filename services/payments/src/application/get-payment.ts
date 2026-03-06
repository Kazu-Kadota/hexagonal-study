import { Payment } from "../domain/payment.js";
import { PaymentCachePort, PaymentRepositoryPort, TelemetryPort } from "./ports.js";

export class GetPaymentUseCase {
    constructor(
      private readonly repository: PaymentRepositoryPort,
      private readonly cache: PaymentCachePort,
      private readonly telemetry: TelemetryPort,
    ) {}

    async execute(paymentId: string): Promise<Payment> {
      return this.telemetry.span("payments.findByPaymentId", async () => {
        const cached = await this.cache.get(`payment:${paymentId}`);

        if (cached) {
            return cached;
        }

        const payment = await this.repository.findById(paymentId);

        if (!payment) {
            throw new Error(`Payment with id ${paymentId} not found`);
        }

        await this.cache.set(`payment:${paymentId}`, payment, 60 * 60);
        return payment;
      });
    }
}