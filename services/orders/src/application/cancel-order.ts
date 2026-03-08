import { Order } from "../domain/order.js";
import {
  EventBusPort,
  OrderCachePort,
  OrderRepositoryPort,
  TelemetryPort
} from "./ports.js";

export class CancelOrderUseCase {
  constructor(
    private readonly orderRepository: OrderRepositoryPort,
    private readonly cache: OrderCachePort,
    private readonly eventBus: EventBusPort,
    private readonly telemetry: TelemetryPort
  ) {}

  private async cancelOrder(order: Order): Promise<void> {
      await this.orderRepository.cancel(order.id);
      await this.cache.set({
        ...order,
        status: "CANCELLED"
      });
      await this.eventBus.publish("order.cancelled", {
        type: "order.cancelled",
        payload: {
          orderId: order.id,
          customerId: order.customerId,
          amount: order.amount,
          currency: order.currency,
        }
      });
  }

  async execute(id: string): Promise<void> {
    return this.telemetry.span("cancel.order", async () => {
      const cached = await this.cache.get(id);

      if (cached) {
        await this.cancelOrder(cached);
        
        return;
      }

      const order = await this.orderRepository.findById(id);
      
      if (!order) {
        throw new Error("Order not found");
      }

      await this.cancelOrder(order);
    })
  }
}