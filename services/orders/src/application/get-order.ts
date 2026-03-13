import { IOrdersCachePort } from "./ports/outbound/cache/cache.js";
import { IOrdersRepositoryReadPort } from "./ports/outbound/database/database-read.js";
import { IOrdersTelemetryPort } from "./ports/outbound/telemetry/telemetry.js";

export class GetOrderUseCase {
  constructor(
    private readonly readOrderRepository: IOrdersRepositoryReadPort,
    private readonly cache: IOrdersCachePort,
    private readonly telemetry: IOrdersTelemetryPort,
  ) {}

  async execute(orderId: string) {
    return this.telemetry.span("orders.get", async () => {
      const cached = await this.cache.get(orderId);
      if (cached) return cached;

      const order = await this.readOrderRepository.findById(orderId);
      if (!order) throw new Error("Order not found");

      await this.cache.set(order);
      return order;
    });
  }
}
