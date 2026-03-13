import type { OrderDTO, OrderStatusType } from "../../../../domain/order.js";
import { FindByCustomerIdProjection, FindByIdProjection, FindByStatusProjection, IOrdersRepositoryReadPort, PaginatedOrders, PaginationParameters } from "../../../../application/ports/outbound/database/database-read.js";
import { PrismaClient } from "../../../../generated/orders/client.js";

export class PostgresOrderRepositoryRead implements IOrdersRepositoryReadPort {
  constructor(private readonly prismaClient: PrismaClient) {}

  private async paginationFind(query: object, pagination: PaginationParameters): Promise<[OrderDTO[], number]> {
    const [docs, total] = await Promise.all([
      this.prismaClient.order
        .findMany({
          take: pagination.pageSize,
          skip: (pagination.page - 1) * pagination.pageSize,
          orderBy: pagination.orderBy
        }),
      this.prismaClient.order.count(query)
    ])

    return [docs, total]
  }

  async findById(id: string): Promise<FindByIdProjection | null> {
    const order = await this.prismaClient.order.findUnique({
      where: {
        id,
      }
    })
    
    return order
  }

  async findByStatus(status: OrderStatusType, pagination: PaginationParameters): Promise<PaginatedOrders<FindByStatusProjection> | null> {
    const [docs, total] = await this.paginationFind({ status }, pagination);

    return {
      data: docs.map(doc => ({
        customerId: doc.customerId,
        id: doc.id,
        status: doc.status,
      })),
      page: pagination.page,
      pageSize: pagination.pageSize,
      total,
      hasNext: pagination.page * pagination.pageSize < total
    }
  }

  async findByCustomerId(customerId: string, pagination: PaginationParameters): Promise<PaginatedOrders<FindByCustomerIdProjection> | null> {
    const [docs, total] = await this.paginationFind({ customerId }, pagination);

    return {
      data: docs.map(doc => ({
        customerId: doc.customerId,
        id: doc.id,
        status: doc.status,
      })),
      page: pagination.page,
      pageSize: pagination.pageSize,
      total,
      hasNext: pagination.page * pagination.pageSize < total
    }
  }
}
