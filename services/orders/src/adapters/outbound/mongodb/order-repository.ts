import type { Collection } from "mongodb";
import type { Order } from "../../../domain/order.js";
import type { OrderRepositoryPort } from "../../../application/ports.js";

export class MongoOrderRepository implements OrderRepositoryPort {
  constructor(private readonly collection: Collection<Order>) {}

  async save(order: Order): Promise<void> {
    await this.collection.insertOne(order);
  }

  async findById(id: string): Promise<Order | null> {
    return this.collection.findOne({ id });
  }

  async cancel(id: string): Promise<void> {
    await this.collection.updateOne({ id }, { 
      $set: { 
        status: "CANCELLED"
      }
    });
  }

  async delete(id: string): Promise<void> {
    await this.collection.deleteOne({ id });
  }
}
