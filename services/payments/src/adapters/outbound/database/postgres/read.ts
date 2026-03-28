import type { PaymentDTO, PaymentStatusType } from "../../../../domain/payment.js";
import {
  FindByIdempotencyProjection,
  FindByIdProjection,
  FindByOrderIdProjection,
  FindByStatusProjection,
  IPaymentsRepositoryReadPort,
  PaginatedPayments,
  PaginationParameters
} from "../../../../application/ports/outbound/database/database-read.js";
import { PrismaClient } from "../../../../generated/payments/client.js";

export class PostgresPaymentRepositoryRead implements IPaymentsRepositoryReadPort {
  constructor(private readonly prismaClient: PrismaClient) {}

  private async paginationFind(query: object, pagination: PaginationParameters): Promise<[PaymentDTO[], number]> {
    const [docs, total] = await Promise.all([
      this.prismaClient.payments
        .findMany({
          take: pagination.pageSize,
          skip: (pagination.page - 1) * pagination.pageSize,
          orderBy: pagination.orderBy
        }),
      this.prismaClient.payments.count(query)
    ]);

    return [docs, total];
  }

  async findById(id: string): Promise<FindByIdProjection | null> {
    const payment = await this.prismaClient.payments.findUnique({
      where: {
        id,
      }
    });
    
    return payment;
  }

  async findByStatus(status: PaymentStatusType, pagination: PaginationParameters): Promise<PaginatedPayments<FindByStatusProjection> | null> {
    const [docs, total] = await this.paginationFind({ status }, pagination);

    return {
      data: docs.map(doc => ({
        orderId: doc.orderId,
        id: doc.id,
        status: doc.status,
      })),
      page: pagination.page,
      pageSize: pagination.pageSize,
      total,
      hasNext: pagination.page * pagination.pageSize < total
    };
  }

  async findByOrderId(orderId: string): Promise<FindByOrderIdProjection | null> {
    const payment = await this.prismaClient.payments.findUnique({
      where: {
        orderId
      }
    });
    
    return payment;
  }

  async findByIdempotencyKey(idempotency_key: string): Promise<FindByIdempotencyProjection | null> {
    const payment = await this.prismaClient.payments.findUnique({
      where: {
        idempotency_key
      }
    });
    
    return payment;
  }
}
