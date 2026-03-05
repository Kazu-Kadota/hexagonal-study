import type {
  OrderCachePort,
  OrderRepositoryPort,
  TelemetryPort,
} from "./ports.js";

export class GetOrderUseCase {
  constructor(
    private readonly repository: OrderRepositoryPort,
    private readonly cache: OrderCachePort,
    private readonly telemetry: TelemetryPort,
  ) {}

  async execute(orderId: string) {
    return this.telemetry.span("orders.get", async () => {
      const cached = await this.cache.get(orderId);
      if (cached) return cached;

      const order = await this.repository.findById(orderId);
      if (order) await this.cache.set(order);
      return order;
    });
  }
}
