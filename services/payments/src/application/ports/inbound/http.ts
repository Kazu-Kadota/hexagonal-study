import { CreatePaymentUseCaseParams } from "../../create-payment.js";

export abstract class IHTTPSPort {
  abstract createPayment(body: CreatePaymentUseCaseParams): Promise<unknown>;
  abstract getPayment(param: { id: string }): Promise<unknown>;
}