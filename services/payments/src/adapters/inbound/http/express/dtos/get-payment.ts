import { CurrencyType, PaymentStatusType } from "../../../../../domain/payment.js";

export type GetPaymentParams = {
  id: string;
}

export type GetPaymentOutput = {
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