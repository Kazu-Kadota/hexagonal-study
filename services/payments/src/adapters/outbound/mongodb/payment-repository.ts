import type { Collection } from "mongodb";
import type { Payment } from "../../../domain/payment.js";
import type { PaymentRepositoryPort } from "../../../application/ports.js";
import { UUID } from "crypto";

export class MongoPaymentRepository implements PaymentRepositoryPort {
  constructor(private readonly collection: Collection<Payment>) {}

  async save(payment: Payment): Promise<void> {
    await this.collection.insertOne(payment);
  }

  async findById(id: string): Promise<Payment | null> {
    return this.collection.findOne({ id });
  }

  async findByIdempotencyKey(idempotencyKey: UUID): Promise<Payment | null> {
    return this.collection.findOne({ idempotency: idempotencyKey });
  }
}
