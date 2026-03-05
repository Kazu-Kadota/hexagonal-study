import { createOrder } from "../domain/order.js";
import type {
  EventBusPort,
  OrderCachePort,
  OrderRepositoryPort,
  TelemetryPort,
} from "./ports.js";

export class CreateOrderUseCase {
  constructor(
    private readonly repository: OrderRepositoryPort,
    private readonly cache: OrderCachePort,
    private readonly eventBus: EventBusPort,
    private readonly telemetry: TelemetryPort,
  ) {}

  async execute(input: {
    customerId: string;
    amount: number;
    currency: string;
  }) {
    return this.telemetry.span("orders.create", async () => {
      const order = createOrder(input);
      await this.repository.save(order);
      await this.cache.set(order);
      await this.eventBus.publish("order.created", {
        type: "order.created",
        payload: {
          orderId: order.id,
          customerId: order.customerId,
          amount: order.amount,
          currency: order.currency,
        },
      });

      return order;
    });
  }
}
