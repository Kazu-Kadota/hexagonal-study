import { CurrencyType, OrderStatusType } from "../../../../entity/order/order.js";

export type PaginationParameters = {
  page: number;
  pageSize: number;
  totalPages: number;
  orderBy?: object;
}

export abstract class PaginatedOrders<T> {
  abstract data: T[];
  abstract page: number;
  abstract pageSize: number;
  abstract total: number;
  abstract hasNext: boolean;
}

export type FindByIdProjection = {
  id: string;
  customerId: string;
  amount: number;
  currency: CurrencyType;
  status: OrderStatusType;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export type FindByStatusProjection = {
  id: string;
  customerId: string;
  status: OrderStatusType;
}

export type FindByCustomerIdProjection = {
  id: string;
  customerId: string;
  status: OrderStatusType;
}

export abstract class IOrdersRepositoryReadPort {
  abstract findById(id: string): Promise<FindByIdProjection | null>;
  abstract findByStatus(status: OrderStatusType, pagination: PaginationParameters): Promise<PaginatedOrders<FindByStatusProjection> | null>;
  abstract findByCustomerId(customerId: string, pagination: PaginationParameters): Promise<PaginatedOrders<FindByCustomerIdProjection> | null>;
}