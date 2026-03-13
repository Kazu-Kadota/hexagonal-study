import { CurrencyType, Order, OrderDTO } from "../domain/order.js";
import { IOrdersCachePort } from "./ports/outbound/cache/cache.js";
import { IOrdersRepositoryWritePort } from "./ports/outbound/database/database-write.js";
import { IOrdersEventBusPort } from "./ports/outbound/messaging/messaging.js";
import { IOrdersTelemetryPort } from "./ports/outbound/telemetry/telemetry.js";

export class CreateOrderUseCase {
  constructor(
      private readonly writeOrderRepository: IOrdersRepositoryWritePort,
      private readonly cache: IOrdersCachePort,
      private readonly eventBus: IOrdersEventBusPort,
      private readonly telemetry: IOrdersTelemetryPort
  ) {}

  async execute(input: {
    customerId: string;
    amount: number;
    currency: CurrencyType;
  }): Promise<OrderDTO> {
    return this.telemetry.span("orders.create", async () => {
      const order = Order.create({
        amount: input.amount,
        currency: input.currency,
        customerId: input.currency,
      })
      const orderDTO = order.toDTO();

      const idempotency = crypto.randomUUID();

      await this.writeOrderRepository.save(orderDTO);
      await this.cache.set(orderDTO);
      await this.eventBus.publish("order.created", {
        type: "order.created",
        payload: {
          orderId: orderDTO.id,
          customerId: orderDTO.customerId,
          amount: orderDTO.amount,
          currency: orderDTO.currency,
          idempotencyKey: idempotency,
        },
      });

      return orderDTO;
    });
  }
}
