import { Order } from "../../../../../domain/order.js";
import { GetOrderOutputDto } from "./order.js";

export class OrderMapper {
  static toGetOrderOutputDto(order: Order): GetOrderOutputDto {
    return {
      id: order.id,
      customerId: order.customerId,
      amount: order.amount,
      currency: order.currency,
      status: order.status,
      createdAt: order.createdAt,
    }
  }
}