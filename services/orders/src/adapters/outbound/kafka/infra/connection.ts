import { Consumer, Kafka, Producer } from "kafkajs";

export class KafkaConnection {
  private client: Kafka | null = null;

  constructor(
    private readonly clientId: string,
    private readonly brokers: string[],
  ) {}

  async connect(): Promise<Kafka> {
    if (this.client) return this.client;

    this.client = new Kafka({
      brokers: this.brokers,
      clientId: this.clientId,
    });
    
    return this.client
  }

  async producer(): Promise<Producer> {
    if (!this.client) {
      throw new Error("KafkaConnection is not connected");
    }

    const producer = this.client.producer();
    await producer.connect();
    return producer;
  }

  async consumer(name: string): Promise<Consumer> {
    if (!this.client) {
      throw new Error("KafkaConnection is not connected");
    }

    const consumer = this.client.consumer({
      groupId: `${this.clientId}-${name}`,
    });
    await consumer.connect();
    return consumer;
  }

  async close(): Promise<void> {
    if (!this.client) return;

    await this.client.admin().disconnect();
    this.client = null;
  }
}