import { CurrencyType, Payment, PaymentDTO, paymentStatus } from "../domain/payment.js";
import { IPaymentsCachePort } from "./ports/outbound/cache/cache.js";
import { IPaymentsRepositoryReadPort } from "./ports/outbound/database/database-read.js";
import { IPaymentsRepositoryWritePort } from "./ports/outbound/database/database-write.js";
import { IPaymentsEventBusPort } from "./ports/outbound/messaging/messaging.js";
import { IPaymentsGatewayPort } from "./ports/outbound/payment-gateway/payment-gateway.js";
import { IPaymentsTelemetryPort } from "./ports/outbound/telemetry/telemetry.js";

export type CreatePaymentUseCaseParams = {
  amount: number;
  currency: CurrencyType;
  idempotencyKey: string;
  orderId: string;
}

export class CreatePaymentUseCase {
  constructor(
    private readonly writeRepository: IPaymentsRepositoryWritePort,
    private readonly readRepository: IPaymentsRepositoryReadPort,
    private readonly gateway: IPaymentsGatewayPort,
    private readonly eventBus: IPaymentsEventBusPort,
    private readonly cache: IPaymentsCachePort,
    private readonly telemetry: IPaymentsTelemetryPort,
  ) {}

  async execute(input: CreatePaymentUseCaseParams): Promise<PaymentDTO> {
    return this.telemetry.span("payments.create", async () => {
      const cacheIdempotencyName = `paymentsIdempotencyKey:${input.idempotencyKey}`
      const cacheIdempotentPayment = await this.cache.get(cacheIdempotencyName);
      if (cacheIdempotentPayment) return cacheIdempotentPayment;

      const idempotentPayment = await this.readRepository.findByIdempotencyKey(input.idempotencyKey);
      if (idempotentPayment) {
        await this.cache.set(cacheIdempotencyName, idempotentPayment);
        await this.cache.set(cacheIdempotencyName, idempotentPayment);
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

      const payment = Payment.create({
        idempotency: input.idempotencyKey,
        orderId: input.orderId,
        amount: input.amount,
        stripePaymentIntentId: intent.id,
        currency: input.currency,
        status: paymentStatus.created,
      });

      const paymentDTO = payment.toDTO()

      await this.writeRepository.save(paymentDTO);
      await this.eventBus.publish("payment.created", {
        type: "payment.created",
        payload: {
          paymentId: paymentDTO.id,
          orderId: paymentDTO.orderId,
          stripePaymentIntentId: paymentDTO.stripePaymentIntentId,
          status: paymentDTO.status,
          idempotency: paymentDTO.idempotency_key,
        },
      });

      const cachePayment = `payments:${paymentDTO.id}`
      await this.cache.set(cachePayment, paymentDTO);
      await this.cache.set(cachePayment, paymentDTO);

      return paymentDTO;
    });
  }
}
