import { BeforeApplicationShutdown, Inject, Injectable } from "@nestjs/common";
import { MongoConnection } from "../../../../outbound/mongodb/infra/connection.js";
import { RedisConnection } from "../../../../outbound/redis/infra/connection.js";
import { KAFKA_CONNECTION, MONGO_CONNECTION, REDIS_CONNECTION } from "../token.js";
import { KafkaConnection } from "../../../../outbound/kafka/infra/connection.js";

@Injectable()
export class ClientShutdownService implements BeforeApplicationShutdown {
  constructor(
    @Inject(MONGO_CONNECTION)
    private mongoConnection: MongoConnection,

    @Inject(REDIS_CONNECTION)
    private redisConnection: RedisConnection,
    
    @Inject(KAFKA_CONNECTION)
    private kafkaConnection: KafkaConnection
  ) {}

  async beforeApplicationShutdown() {
    console.log("Shutting down gracefully...");

    const results = await Promise.allSettled([
      this.mongoConnection.close(),
      this.redisConnection.close(),
      this.kafkaConnection.close(),
    ])

    for (const result of results) {
      if (result.status === "rejected") {
        console.error("Shutdown error:", result.reason);
      }
    }

    console.log("All infrastructure connections were closed.");
  }
}