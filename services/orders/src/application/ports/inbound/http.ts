import { CreateOrderBody } from "../../../adapters/inbound/http/nest/dtos/create-order.js";

export abstract class IHTTPSPort {
  abstract createOrder(body: CreateOrderBody): Promise<unknown>;
  abstract getOrder(param: { id: string }): Promise<unknown>;
  abstract deleteOrder(param: { id: string }): Promise<unknown>;
  abstract cancelOrder(param: { id: string }): Promise<unknown>;
}