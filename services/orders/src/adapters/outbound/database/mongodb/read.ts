import type { Collection, WithId } from "mongodb";
import type { OrderDTO, OrderStatusType } from "../../../../entity/order/order.js";
import {
  FindByCustomerIdProjection,
  FindByIdProjection,
  FindByStatusProjection,
  IOrdersRepositoryReadPort,
  PaginatedOrders,
  PaginationParameters
} from "../../../../application/ports/outbound/database/database-read.js";

export class MongoOrderRepositoryRead implements IOrdersRepositoryReadPort {
  constructor(private readonly collection: Collection<OrderDTO>) {}

  private async paginationFind(query: object, pagination: PaginationParameters): Promise<[WithId<OrderDTO>[], number]> {
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

  async findByStatus(status: OrderStatusType, pagination: PaginationParameters): Promise<PaginatedOrders<FindByStatusProjection> | null> {
    const [docs, total] = await this.paginationFind({ status }, pagination);

    return {
      data: docs.map(doc => {
        return {
          customerId: doc.customerId,
          id: doc.id,
          status: doc.status,
        }
      }),
      page: pagination.page,
      pageSize: pagination.pageSize,
      total,
      hasNext: pagination.page * pagination.pageSize < total
    }
  }

  async findByCustomerId(customerId: string, pagination: PaginationParameters): Promise<PaginatedOrders<FindByCustomerIdProjection> | null> {
    const [docs, total] = await this.paginationFind({ customerId }, pagination);

    return {
      data: docs.map(doc => {
        return {
          customerId: doc.customerId,
          id: doc.id,
          status: doc.status,
        }
      }),
      page: pagination.page,
      pageSize: pagination.pageSize,
      total,
      hasNext: pagination.page * pagination.pageSize < total
    }
  }
}
