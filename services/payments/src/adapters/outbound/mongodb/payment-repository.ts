import type { Collection } from "mongodb";
import type { Payment } from "../../../domain/payment.js";
import type { PaymentRepositoryPort } from "../../../application/ports.js";

export class MongoPaymentRepository implements PaymentRepositoryPort {
  constructor(private readonly collection: Collection<Payment>) {}

  async save(payment: Payment): Promise<void> {
    await this.collection.insertOne(payment);
  }
}
