import type { Collection, WithId } from "mongodb";
import type { Order, OrderStatusType } from "../../../../domain/order.js";
import { FindByCustomerIdProjection, FindByIdProjection, FindByStatusProjection, IOrdersRepositoryReadPort, PaginatedOrders, PaginationParameters } from "../../../../application/ports/outbound/database/database-read.js";

export class MongoOrderRepositoryRead implements IOrdersRepositoryReadPort {
  constructor(private readonly collection: Collection<Order>) {}

  private async paginationFind(query: object, pagination: PaginationParameters): Promise<[WithId<Order>[], number]> {
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
      const orderDTO = order.toDTO()
      
      return { 
        amount: orderDTO.amount,
        createdAt: orderDTO.createdAt,
        currency: orderDTO.currency,
        customerId: orderDTO.customerId,
        id: orderDTO.id,
        status: orderDTO.status,
        updatedAt: orderDTO.updatedAt,
      };
    }

    return null
  }

  async findByStatus(status: OrderStatusType, pagination: PaginationParameters): Promise<PaginatedOrders<FindByStatusProjection> | null> {
    const [docs, total] = await this.paginationFind({ status }, pagination);

    return {
      data: docs.map(doc => {
        const orderDTO = doc.toDTO();

        return {
          customerId: orderDTO.customerId,
          id: orderDTO.id,
          status: orderDTO.status,
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
        const orderDTO = doc.toDTO();

        return {
          customerId: orderDTO.customerId,
          id: orderDTO.id,
          status: orderDTO.status,
        }
      }),
      page: pagination.page,
      pageSize: pagination.pageSize,
      total,
      hasNext: pagination.page * pagination.pageSize < total
    }
  }
}
