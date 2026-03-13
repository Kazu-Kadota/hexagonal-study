import type { OrderDTO } from "../../../../domain/order.js";
import { FindByIdProjection } from "../../../../application/ports/outbound/database/database-read.js";
import { IOrdersRepositoryWritePort } from "../../../../application/ports/outbound/database/database-write.js";
import { PrismaClient } from "../../../../generated/orders/client.js";

export class PostgresOrderRepositoryWrite implements IOrdersRepositoryWritePort {
  constructor(private readonly prismaClient: PrismaClient) {}

  async save(order: OrderDTO): Promise<void> {
    await this.prismaClient.order.upsert({
      create: order,
      update: order,
      where: {
        id: order.id
      }
    });
  }

  async updateOne(order: OrderDTO): Promise<void> {
    await this.prismaClient.order.upsert({
      create: order,
      update: order,
      where: {
        id: order.id
      }
    });
  }

  async delete(id: string): Promise<void> {
    await this.prismaClient.order.delete({
      where: {
        id,
      }
    })
  }

  async findById(id: string): Promise<FindByIdProjection | null> {
    const order = await this.prismaClient.order.findUnique({
      where: {
        id,
      }
    })
    
    return order
  }
}
