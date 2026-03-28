import type { Collection } from "mongodb";
import type { PaymentDTO } from "../../../../domain/payment.js";
import { FindByIdProjection } from "../../../../application/ports/outbound/database/database-read.js";
import { IPaymentsRepositoryWritePort } from "../../../../application/ports/outbound/database/database-write.js";

export class MongoPaymentRepositoryWrite implements IPaymentsRepositoryWritePort {
  constructor(private readonly collection: Collection<PaymentDTO>) {}

  async save(payment: PaymentDTO): Promise<void> {
    await this.collection.insertOne(payment);
  }

  async updateOne(payment: PaymentDTO): Promise<void> {
    await this.collection.updateOne({ id: payment.id }, { 
      $set: {
        ...payment
      }
    });
  }

  async delete(id: string): Promise<void> {
    await this.collection.deleteOne({ id });
  }

  async findById(id: string): Promise<FindByIdProjection | null> {
    const payment = await this.collection.findOne({ id });
    if (payment) {
      return { 
        amount: payment.amount,
        createdAt: payment.createdAt,
        currency: payment.currency,
        id: payment.id,
        idempotency_key: payment.idempotency_key,
        orderId: payment.orderId,
        stripePaymentIntentId: payment.stripePaymentIntentId,
        status: payment.status,
        updatedAt: payment.updatedAt,
      };
    }

    return null
  }
}
