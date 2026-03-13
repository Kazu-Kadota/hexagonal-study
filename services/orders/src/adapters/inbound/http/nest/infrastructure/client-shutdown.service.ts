import { BeforeApplicationShutdown, Inject, Injectable } from "@nestjs/common";
import { KAFKA_CONNECTION, MONGO_CONNECTION, POSTGRES_CONNECTION, REDIS_CONNECTION } from "../token.js";
import { KafkaConnection } from "../../../../../infrastructure/messaging/kafka/connection.js";
import { MongoConnection } from "../../../../../infrastructure/database/mongodb/connection.js";
import { RedisConnection } from "../../../../../infrastructure/cache/redis/connection.js";
import { PostgresConnection } from "../../../../../infrastructure/database/postgres/connection.js";

@Injectable()
export class ClientShutdownService implements BeforeApplicationShutdown {
  constructor(
    @Inject(POSTGRES_CONNECTION)
    private postgresConnection: PostgresConnection,

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
      this.postgresConnection.close(),
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