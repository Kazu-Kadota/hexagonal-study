import type { Order } from "../domain/order.js";

export abstract class OrderRepositoryPort {
  abstract save(order: Order): Promise<void>;
  abstract findById(id: string): Promise<Order | null>;
  abstract cancel(id: string): Promise<void>;
  abstract delete(id: string): Promise<void>;
}

export abstract class OrderCachePort {
  abstract get(id: string): Promise<Order | null>;
  abstract set(order: Order): Promise<void>;
  abstract delete(id: string): Promise<void>;
}

export abstract class EventBusPort {
  abstract publish(topic: string, message: object): Promise<void>;
}

export abstract class TelemetryPort {
  abstract span<T>(name: string, fn: () => Promise<T>): Promise<T>;
}
