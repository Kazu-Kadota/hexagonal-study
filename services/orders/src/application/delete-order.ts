import { EventBusPort, OrderCachePort, OrderRepositoryPort, TelemetryPort } from "./ports.js";

export class DeleteOrderUseCase {
  constructor(
    private readonly orderRepository: OrderRepositoryPort,
    private readonly cache: OrderCachePort,
    private readonly eventBus: EventBusPort,
    private readonly telemetry: TelemetryPort
  ) {}

  private async deleteOrder(id: string): Promise<void> {
    await this.orderRepository.delete(id);
    await this.eventBus.publish("order.deleted", { 
      type: "order.deleted",
      payload: {
        orderId: id,
      }});
  }

  async execute(id: string): Promise<void> {
    return this.telemetry.span("delete.order", async () => {
      const cached = await this.cache.get(id);

      if (cached) {
        await this.deleteOrder(id);
        await this.cache.delete(id);

        return;
      }

      const order = await this.orderRepository.findById(id);

      if (!order) {
        throw new Error("Order not found");
      }

      await this.orderRepository.delete(id);
      await this.eventBus.publish("order.deleted", { 
        type: "order.deleted",
        payload: {
          orderId: order.id,
        }});
    });
  }
}