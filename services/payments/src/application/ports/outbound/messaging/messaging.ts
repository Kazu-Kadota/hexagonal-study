export abstract class IPaymentsEventBusPort {
  abstract publish(topic: string, message: object): Promise<void>;
}