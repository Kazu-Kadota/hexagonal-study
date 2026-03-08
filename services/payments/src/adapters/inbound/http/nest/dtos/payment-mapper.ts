import { Payment } from "../../../../../domain/payment.js";
import { GetPaymentOutputDto } from "./payment.js";

export class PaymentMapper {
  static toGetPaymentOutputDto(payment: Payment): GetPaymentOutputDto {
    return {
      id: payment.id,
      idempotency: payment.idempotency,
      orderId: payment.orderId,
      amount: payment.amount,
      currency: payment.currency,
      stripePaymentIntentId: payment.stripePaymentIntentId,
      status: payment.status,
      createdAt: payment.createdAt,
    }
  }
}