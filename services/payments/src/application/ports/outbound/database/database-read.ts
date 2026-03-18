import { CurrencyType, PaymentStatusType } from "../../../../domain/payment.js";

export type PaginationParameters = {
  page: number;
  pageSize: number;
  totalPages: number;
  orderBy?: object;
}

export abstract class PaginatedPayments<T> {
  abstract data: T[];
  abstract page: number;
  abstract pageSize: number;
  abstract total: number;
  abstract hasNext: boolean;
}

export type FindByIdProjection = {
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

export type FindByIdempotencyProjection = {
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

export type FindByStatusProjection = {
  id: string;
  orderId: string;
  status: PaymentStatusType;
}

export type FindByOrderIdProjection = {
  id: string;
  orderId: string;
  status: PaymentStatusType;
}

export abstract class IPaymentsRepositoryReadPort {
  abstract findById(id: string): Promise<FindByIdProjection | null>;
  abstract findByIdempotencyKey(idempotency_key: string): Promise<FindByIdempotencyProjection | null>;
  abstract findByStatus(status: PaymentStatusType, pagination: PaginationParameters): Promise<PaginatedPayments<FindByStatusProjection> | null>;
  abstract findByOrderId(orderId: string): Promise<FindByOrderIdProjection | null>;
}