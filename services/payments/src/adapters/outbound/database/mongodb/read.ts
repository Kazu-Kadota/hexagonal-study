import type { Collection, WithId } from "mongodb";
import type { PaymentDTO, PaymentStatusType } from "../../../../domain/payment.js";
import { 
  FindByOrderIdProjection,
  FindByIdProjection,
  FindByStatusProjection,
  IPaymentsRepositoryReadPort,
  PaginatedPayments,
  PaginationParameters
} from "../../../../application/ports/outbound/database/database-read.js";

export class MongoPaymentRepositoryRead implements IPaymentsRepositoryReadPort {
  constructor(private readonly collection: Collection<PaymentDTO>) {}

  private async paginationFind(query: object, pagination: PaginationParameters): Promise<[WithId<PaymentDTO>[], number]> {
    const [docs, total] = await Promise.all([
      this.collection
        .find(query)
        .skip((pagination.page - 1) * pagination.pageSize)
        .limit(pagination.pageSize)
        .toArray(),
      this.collection.countDocuments(query)
    ])

    return [docs, total]
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

  async findByIdempotencyKey(idempotency_key: string): Promise<FindByIdProjection | null> {
    const payment = await this.collection.findOne({ idempotency_key });
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

  async findByStatus(status: PaymentStatusType, pagination: PaginationParameters): Promise<PaginatedPayments<FindByStatusProjection> | null> {
    const [docs, total] = await this.paginationFind({ status }, pagination);

    return {
      data: docs.map(doc => {
        return {
          id: doc.id,
          orderId: doc.orderId,
          status: doc.status,
        }
      }),
      page: pagination.page,
      pageSize: pagination.pageSize,
      total,
      hasNext: pagination.page * pagination.pageSize < total
    }
  }

  async findByOrderId(orderId: string): Promise<FindByOrderIdProjection | null> {
    const payment = await this.collection.findOne({ orderId });
    if (payment) {
      return { 
        id: payment.id,
        orderId: payment.orderId,
        status: payment.status,
      };
    }

    return null
  }
}
