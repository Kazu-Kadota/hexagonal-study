import type { PaymentDTO } from "../../../../domain/payment.js";
import { FindByIdProjection } from "../../../../application/ports/outbound/database/database-read.js";
import { IPaymentsRepositoryWritePort } from "../../../../application/ports/outbound/database/database-write.js";
import { PrismaClient } from "../../../../generated/payments/client.js";

export class PostgresPaymentRepositoryWrite implements IPaymentsRepositoryWritePort {
  constructor(private readonly prismaClient: PrismaClient) {}

  async save(payment: PaymentDTO): Promise<void> {
    await this.prismaClient.payments.upsert({
      create: payment,
      update: payment,
      where: {
        id: payment.id
      }
    });
  }

  async updateOne(payment: PaymentDTO): Promise<void> {
    await this.prismaClient.payments.upsert({
      create: payment,
      update: payment,
      where: {
        id: payment.id
      }
    });
  }

  async delete(id: string): Promise<void> {
    await this.prismaClient.payments.delete({
      where: {
        id,
      }
    })
  }

  async findById(id: string): Promise<FindByIdProjection | null> {
    const payment = await this.prismaClient.payments.findUnique({
      where: {
        id,
      }
    })
    
    return payment
  }
}
