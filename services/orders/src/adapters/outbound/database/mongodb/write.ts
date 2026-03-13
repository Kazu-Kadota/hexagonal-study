import type { Collection } from "mongodb";
import type { OrderDTO } from "../../../../domain/order.js";
import { FindByIdProjection } from "../../../../application/ports/outbound/database/database-read.js";
import { IOrdersRepositoryWritePort } from "../../../../application/ports/outbound/database/database-write.js";

export class MongoOrderRepositoryWrite implements IOrdersRepositoryWritePort {
  constructor(private readonly collection: Collection<OrderDTO>) {}

  async save(order: OrderDTO): Promise<void> {
    await this.collection.insertOne(order);
  }

  async updateOne(order: OrderDTO): Promise<void> {
    await this.collection.updateOne({ id: order.id }, { 
      $set: {
        ...order
      }
    });
  }

  async delete(id: string): Promise<void> {
    await this.collection.deleteOne({ id });
  }

  async findById(id: string): Promise<FindByIdProjection | null> {
    const order = await this.collection.findOne({ id });
    if (order) {
      return { 
        amount: order.amount,
        createdAt: order.createdAt,
        currency: order.currency,
        customerId: order.customerId,
        id: order.id,
        status: order.status,
        updatedAt: order.updatedAt,
      };
    }

    return null
  }
}
