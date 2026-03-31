import { Inject, Injectable } from "@nestjs/common";
import { CancelOrderUseCase } from "../../../../application/use-cases/cancel-order.js";
import { DeleteOrderUseCase } from "../../../../application/use-cases/delete-order.js";
import { GetOrderUseCase } from "../../../../application/use-cases/get-order.js";
import { CreateOrderUseCase } from "../../../../application/use-cases/create-order.js";
import { CurrencyType, OrderDTO } from "../../../../entity/order/order.js";

@Injectable()
export class OrderService {
  constructor(
    @Inject(CreateOrderUseCase)
    private readonly createOrderUseCase: CreateOrderUseCase,
    
    @Inject(GetOrderUseCase)
    private readonly getOrderUseCase: GetOrderUseCase,
    
    @Inject(CancelOrderUseCase)
    private readonly cancelOrderUseCase: CancelOrderUseCase,
    
    @Inject(DeleteOrderUseCase)
    private readonly deleteOrderUseCase: DeleteOrderUseCase
  ) {}

  async createOrder(input: {
    customerId: string;
    amount: number;
    currency: CurrencyType;
  }): Promise<OrderDTO> {
    return await this.createOrderUseCase.execute(input);
  }

  async getOrder(id: string): Promise<OrderDTO> {
    return await this.getOrderUseCase.execute(id);
  }

  async cancelOrder(id: string): Promise<void> {
    await this.cancelOrderUseCase.execute(id);
  }

  async deleteOrder(id: string): Promise<void> {
    await this.deleteOrderUseCase.execute(id);
  }
}