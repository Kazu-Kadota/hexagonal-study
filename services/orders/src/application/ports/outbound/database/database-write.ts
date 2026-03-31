import { OrderDTO } from "../../../../entity/order/order.js";
import { FindByIdProjection } from "./database-read.js";

export abstract class IOrdersRepositoryWritePort {
  abstract findById(id: string): Promise<FindByIdProjection | null>;
  abstract save(order: OrderDTO): Promise<void>;
  abstract updateOne(order: OrderDTO): Promise<void>;
  abstract delete(id: string): Promise<void>;
}