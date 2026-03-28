import { CurrencyType, PaymentStatusType } from "../../../../../domain/payment.js";

export type CreatePaymentBody = {
  amount: number;
  currency: CurrencyType;
  idempotencyKey: string;
  orderId: string;
}

export type CreatePaymentOutput = {
  id: string;
  idempotency_key: string;
  orderId: string;
  amount: number;
  currency: CurrencyType;
  stripePaymentIntentId: string;
  status: PaymentStatusType;
  createdAt: Date | string;
  updatedAt: Date | string;
}
