import type { Payment } from "../domain/payment.js";

export interface PaymentRepositoryPort {
  save(payment: Payment): Promise<void>;
}

export interface PaymentGatewayPort {
  createPaymentIntent(input: {
    amount: number;
    currency: string;
    metadata: Record<string, string>;
  }): Promise<{ id: string; status: string }>;
}

export interface EventBusPort {
  publish(topic: string, message: object): Promise<void>;
}

export interface TelemetryPort {
  span<T>(name: string, fn: () => Promise<T>): Promise<T>;
}
