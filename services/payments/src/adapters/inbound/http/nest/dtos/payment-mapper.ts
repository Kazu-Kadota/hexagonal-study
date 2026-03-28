import { PaymentDomain } from "../../../../../domain/payment.js";
import { GetPaymentOutputDto } from "./payment.js";

export class PaymentMapper {
  static toGetPaymentOutputDto(payment: PaymentDomain): GetPaymentOutputDto {
    return {
      id: payment.id,
      idempotency: payment.idempotency_key,
      orderId: payment.orderId,
      amount: payment.amount,
      currency: payment.currency,
      stripePaymentIntentId: payment.stripePaymentIntentId,
      status: payment.status,
      createdAt: payment.createdAt,
    }
  }
}