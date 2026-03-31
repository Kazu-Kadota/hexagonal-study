import { OrderDTO } from "../../../../entity/order/order.js";

export abstract class IOrdersCachePort {
  abstract get(id: string): Promise<OrderDTO | null>;
  abstract set(order: OrderDTO): Promise<void>;
  abstract delete(id: string): Promise<void>;
}