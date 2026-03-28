import type { Producer } from "kafkajs";
import { IPaymentsEventBusPort } from "../../../../application/ports/outbound/messaging/messaging.js";

export class KafkaEventBus implements IPaymentsEventBusPort {
  constructor(private readonly producer: Producer) {}

  async publish(topic: string, message: object): Promise<void> {
    await this.producer.send({
      topic,
      messages: [{ value: JSON.stringify(message) }],
    });
  }
}
