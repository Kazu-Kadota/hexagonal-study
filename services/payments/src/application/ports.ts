import type { Payment } from "../domain/payment.js";

export interface PaymentRepositoryPort {
  save(payment: Payment): Promise<void>;
  findById(id: string): Promise<Payment | null>;
  findByIdempotencyKey(idempotencyKey: string): Promise<Payment | null>;
}

export type PaymentGatewayPortInput = {
  amount: number;
  currency: string;
  metadata: Record<string, string>;
  idempotencyKey: string;
};

export interface PaymentGatewayPort {
  createPaymentIntent(input: PaymentGatewayPortInput): Promise<{ id: string; status: string }>;
}

export interface PaymentCachePort {
  get<T = Payment>(id: string): Promise<T | null>;
  set<T = Payment>(id: string, value: T, ttlSeconds?: number): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface EventBusPort {
  publish(topic: string, message: object): Promise<void>;
}

export interface TelemetryPort {
  span<T>(name: string, fn: () => Promise<T>): Promise<T>;
}
