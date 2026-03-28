import { PaymentDTO } from "../../../../domain/payment.js";
import { FindByIdProjection } from "./database-read.js";

export abstract class IPaymentsRepositoryWritePort {
  abstract findById(id: string): Promise<FindByIdProjection | null>;
  abstract save(payment: PaymentDTO): Promise<void>;
  abstract updateOne(payment: PaymentDTO): Promise<void>;
  abstract delete(id: string): Promise<void>;
}