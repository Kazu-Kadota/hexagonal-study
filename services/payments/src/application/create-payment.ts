import { UUID } from "crypto";
import { createPaymentRecord } from "../domain/payment.js";
import type {
  EventBusPort,
  PaymentCachePort,
  PaymentGatewayPort,
  PaymentRepositoryPort,
  TelemetryPort,
} from "./ports.js";

export class CreatePaymentUseCase {
  constructor(
    private readonly repository: PaymentRepositoryPort,
    private readonly gateway: PaymentGatewayPort,
    private readonly eventBus: EventBusPort,
    private readonly cache: PaymentCachePort,
    private readonly telemetry: TelemetryPort,
  ) {}

  async execute(input: { 
    amount: number;
    currency: string;
    idempotencyKey: UUID;
    orderId: string;
  }) {
    return this.telemetry.span("payments.create", async () => {
      const cacheIdempotentPayment = await this.cache.get(`idempotency:${input.idempotencyKey}`);
      if (cacheIdempotentPayment) return cacheIdempotentPayment;

      const idempotentPayment = await this.repository.findByIdempotencyKey(input.idempotencyKey);
      if (idempotentPayment) {
        await this.cache.set(`payment:${idempotentPayment.id}`, idempotentPayment, 60 * 60);
        await this.cache.set(`idempotency:${idempotentPayment.idempotency}`, idempotentPayment, 60 * 5);
        return idempotentPayment;
      }

      const intent = await this.gateway.createPaymentIntent({
        amount: input.amount,
        currency: input.currency,
        idempotencyKey: input.idempotencyKey,
        metadata: {
          orderId: input.orderId,
        },
      });

      const payment = createPaymentRecord({
        idempotency: input.idempotencyKey,
        orderId: input.orderId,
        amount: input.amount,
        currency: input.currency,
        stripePaymentIntentId: intent.id,
        status: intent.status,
      });

      await this.repository.save(payment);
      await this.eventBus.publish("payment.created", {
        type: "payment.created",
        payload: {
          paymentId: payment.id,
          orderId: payment.orderId,
          stripePaymentIntentId: payment.stripePaymentIntentId,
          status: payment.status,
          idempotency: payment.idempotency,
        },
      });
      await this.cache.set(`payment:${payment.id}`, payment, 60 * 60);
      await this.cache.set(`idempotency:${payment.idempotency}`, payment, 60 * 5);

      return payment;
    });
  }
}
