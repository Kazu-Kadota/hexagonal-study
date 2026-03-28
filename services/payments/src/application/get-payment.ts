import { PaymentDTO } from "../domain/payment.js";
import { IPaymentsCachePort } from "./ports/outbound/cache/cache.js";
import { IPaymentsRepositoryReadPort } from "./ports/outbound/database/database-read.js";
import { IPaymentsTelemetryPort } from "./ports/outbound/telemetry/telemetry.js";

export class GetPaymentUseCase {
    constructor(
      private readonly readRepository: IPaymentsRepositoryReadPort,
      private readonly cache: IPaymentsCachePort,
      private readonly telemetry: IPaymentsTelemetryPort,
    ) {}

    async execute(id: string): Promise<PaymentDTO> {
      return this.telemetry.span("payments.getPayment", async () => {
        const cacheName = `payment:${id}`
        const cached = await this.cache.get(cacheName);

        if (cached) return cached;

        const payment = await this.readRepository.findById(id);

        if (!payment) throw new Error(`Payment with id ${id} not found`, {
          cause: {
            status: 404,
          }
        });

        await this.cache.set(cacheName, payment);
        return payment;
      });
    }
}