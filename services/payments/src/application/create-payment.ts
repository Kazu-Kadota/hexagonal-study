import { createPaymentRecord } from "../domain/payment.js";
import type {
  EventBusPort,
  PaymentGatewayPort,
  PaymentRepositoryPort,
  TelemetryPort,
} from "./ports.js";

export class CreatePaymentUseCase {
  constructor(
    private readonly repository: PaymentRepositoryPort,
    private readonly gateway: PaymentGatewayPort,
    private readonly eventBus: EventBusPort,
    private readonly telemetry: TelemetryPort,
  ) {}

  async execute(input: { orderId: string; amount: number; currency: string }) {
    return this.telemetry.span("payments.create", async () => {
      const intent = await this.gateway.createPaymentIntent({
        amount: input.amount,
        currency: input.currency,
        metadata: { orderId: input.orderId },
      });

      const payment = createPaymentRecord({
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
        },
      });

      return payment;
    });
  }
}
