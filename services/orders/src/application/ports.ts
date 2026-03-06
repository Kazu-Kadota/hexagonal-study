import type { Order } from "../domain/order.js";

export interface OrderRepositoryPort {
  save(order: Order): Promise<void>;
  findById(id: string): Promise<Order | null>;
  cancel(id: string): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface OrderCachePort {
  get(id: string): Promise<Order | null>;
  set(order: Order): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface EventBusPort {
  publish(topic: string, message: object): Promise<void>;
}

export interface TelemetryPort {
  span<T>(name: string, fn: () => Promise<T>): Promise<T>;
}
