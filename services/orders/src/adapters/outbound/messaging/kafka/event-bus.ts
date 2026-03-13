import type { Producer } from "kafkajs";
import { IOrdersEventBusPort } from "../../../../application/ports/outbound/messaging/messaging.js";

export class KafkaEventBus implements IOrdersEventBusPort {
  constructor(private readonly producer: Producer) {}

  async publish(topic: string, message: object): Promise<void> {
    await this.producer.send({
      topic,
      messages: [{ value: JSON.stringify(message) }],
    });
  }
}
