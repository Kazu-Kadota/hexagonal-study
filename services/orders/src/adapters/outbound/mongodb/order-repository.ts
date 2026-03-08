import type { Collection } from "mongodb";
import type { Order } from "../../../domain/order.js";
import type { OrderRepositoryPort } from "../../../application/ports.js";
import { UUID } from "node:crypto";

export class MongoOrderRepository implements OrderRepositoryPort {
  constructor(private readonly collection: Collection<Order>) {}

  async save(order: Order): Promise<void> {
    await this.collection.insertOne(order);
  }

  async findById(id: UUID): Promise<Order | null> {
    return this.collection.findOne({ id });
  }

  async cancel(id: UUID): Promise<void> {
    await this.collection.updateOne({ id }, { 
      $set: { 
        status: "CANCELLED"
      }
    });
  }

  async delete(id: UUID): Promise<void> {
    await this.collection.deleteOne({ id });
  }
}
