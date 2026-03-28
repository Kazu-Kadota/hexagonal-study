import { PaymentDTO } from "../../../../domain/payment.js";

export abstract class IPaymentsCachePort {
  abstract get(name: string): Promise<PaymentDTO | null>;
  abstract set(name: string, payment: PaymentDTO): Promise<void>;
  abstract delete(id: string): Promise<void>;
}