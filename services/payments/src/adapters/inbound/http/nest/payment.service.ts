import { Inject, Injectable } from "@nestjs/common";
import { GetPaymentUseCase } from "../../../../application/get-payment.js";
import { CreatePaymentUseCase } from "../../../../application/create-payment.js";
import { FindPaymentByIdempotencyUseCase } from "../../../../application/find-payment-by-idempotency.js";
import { PaymentDomain } from "../../../../domain/payment.js";

@Injectable()
export class PaymentService {
  constructor(
    @Inject(CreatePaymentUseCase)
    private readonly createPaymentUseCase: CreatePaymentUseCase,
    
    @Inject(GetPaymentUseCase)
    private readonly getPaymentUseCase: GetPaymentUseCase,
    
    @Inject(FindPaymentByIdempotencyUseCase)
    private readonly findPaymentByIdempotencyUseCase: FindPaymentByIdempotencyUseCase
  ) {}

  async createPayment(input: {
    amount: number;
    currency: string;
    idempotencyKey: string;
    orderId: string;
  }): Promise<PaymentDomain> {
    return await this.createPaymentUseCase.execute(input);
  }

  async getPayment(id: string): Promise<PaymentDomain> {
    return await this.getPaymentUseCase.execute(id);
  }

  async findPaymentByIdempotency(id: string): Promise<PaymentDomain | null> {
    return await this.findPaymentByIdempotencyUseCase.execute(id);
  }
}