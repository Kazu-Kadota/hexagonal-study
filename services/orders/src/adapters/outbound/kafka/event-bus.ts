import type { Producer } from "kafkajs";
import type { EventBusPort } from "../../../application/ports.js";

export class KafkaEventBus implements EventBusPort {
  constructor(private readonly producer: Producer) {}

  async publish(topic: string, message: object): Promise<void> {
    await this.producer.send({
      topic,
      messages: [{ value: JSON.stringify(message) }],
    });
  }
}
