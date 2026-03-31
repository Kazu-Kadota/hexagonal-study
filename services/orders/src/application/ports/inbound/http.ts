import { CreateOrderUseCaseExecuteParams } from "../../use-cases/create-order.js";

export abstract class IHTTPSPort {
  abstract createOrder(body: CreateOrderUseCaseExecuteParams): Promise<unknown>;
  abstract getOrder(param: { id: string }): Promise<unknown>;
  abstract deleteOrder(param: { id: string }): Promise<unknown>;
  abstract cancelOrder(param: { id: string }): Promise<unknown>;
}