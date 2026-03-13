import { IOrdersCachePort } from "./ports/outbound/cache/cache.js";
import { IOrdersRepositoryWritePort } from "./ports/outbound/database/database-write.js";
import { IOrdersEventBusPort } from "./ports/outbound/messaging/messaging.js";
import { IOrdersTelemetryPort } from "./ports/outbound/telemetry/telemetry.js";

export class DeleteOrderUseCase {
  constructor(
    private readonly writeOrderRepository: IOrdersRepositoryWritePort,
    private readonly cache: IOrdersCachePort,
    private readonly eventBus: IOrdersEventBusPort,
    private readonly telemetry: IOrdersTelemetryPort,
  ) {}

  private async deleteOrder(id: string): Promise<void> {
    await this.writeOrderRepository.delete(id);
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

      const order = await this.writeOrderRepository.findById(id);

      if (!order) throw new Error("Order not found");

      await this.writeOrderRepository.delete(id);
      await this.eventBus.publish("order.deleted", { 
        type: "order.deleted",
        payload: {
          orderId: order.id,
        }
      });
    });
  }
}