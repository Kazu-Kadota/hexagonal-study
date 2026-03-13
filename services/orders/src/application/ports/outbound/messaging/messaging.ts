export abstract class IOrdersEventBusPort {
  abstract publish(topic: string, message: object): Promise<void>;
}