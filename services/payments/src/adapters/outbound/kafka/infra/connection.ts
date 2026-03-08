import { Consumer, Kafka, Producer } from "kafkajs";

export class KafkaConnection {
  private client: Kafka | null = null;
  private connectedProducer: Producer | null = null;
  private connectedConsumers: Consumer[] = [];

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

    if (this.connectedProducer) return this.connectedProducer;

    const producer = this.client.producer();
    await producer.connect();
    this.connectedProducer = producer;
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
    this.connectedConsumers.push(consumer);
    return consumer;
  }

  async close(): Promise<void> {
    if (!this.client) return;

    const closeOperations: Promise<unknown>[] = [];

    if (this.connectedProducer) {
      closeOperations.push(this.connectedProducer.disconnect());
      this.connectedProducer = null;
    }

    if (this.connectedConsumers.length) {
      closeOperations.push(...this.connectedConsumers.map((consumer) => consumer.disconnect()));
      this.connectedConsumers = [];
    }

    await Promise.allSettled(closeOperations);
    this.client = null;
  }
}