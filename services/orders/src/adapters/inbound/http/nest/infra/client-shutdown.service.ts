import { BeforeApplicationShutdown, Inject, Injectable } from "@nestjs/common";
import { Producer } from "kafkajs";
import { MongoConnection } from "../../../../outbound/mongodb/infra/connection.js";
import { RedisConnection } from "../../../../outbound/redis/infra/connection.js";
import { KAFKA_PRODUCER, MONGO_CONNECTION, REDIS_CONNECTION } from "../token.js";

@Injectable()
export class ClientShutdownService implements BeforeApplicationShutdown {
  constructor(
    @Inject(MONGO_CONNECTION)
    private mongoConnection: MongoConnection,

    @Inject(REDIS_CONNECTION)
    private redisConnection: RedisConnection,
    
    @Inject(KAFKA_PRODUCER)
    private kafkaProducer: Producer
  ) {}

  async onApplicationShutdown(signal: NodeJS.Signals): Promise<void> {
  }

  async beforeApplicationShutdown() {
    console.log("Shutting down gracefully...");

    const results = await Promise.allSettled([
      this.mongoConnection.close(),
      this.redisConnection.close(),
      this.kafkaProducer.disconnect(),
    ])

    for (const result of results) {
      if (result.status === "rejected") {
        console.error("Shutdown error:", result.reason);
      }
    }

    console.log("All infrastructure connections were closed.");
  }
}