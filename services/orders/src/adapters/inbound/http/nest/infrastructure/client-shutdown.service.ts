import { BeforeApplicationShutdown, Inject, Injectable } from "@nestjs/common";
import { KAFKA_CONNECTION, MONGO_READ_CONNECTION, MONGO_WRITE_CONNECTION, POSTGRES_READ_CONNECTION, POSTGRES_WRITE_CONNECTION, REDIS_CONNECTION } from "../token.js";
import { KafkaConnection } from "../../../../../infrastructure/messaging/kafka/connection.js";
import { MongoConnection } from "../../../../../infrastructure/database/mongodb/connection.js";
import { RedisConnection } from "../../../../../infrastructure/cache/redis/connection.js";
import { PostgresConnection } from "../../../../../infrastructure/database/postgres/connection.js";

@Injectable()
export class ClientShutdownService implements BeforeApplicationShutdown {
  constructor(
    @Inject(POSTGRES_WRITE_CONNECTION)
    private postgresWriteConnection: PostgresConnection,

    @Inject(POSTGRES_READ_CONNECTION)
    private postgresReadConnection: PostgresConnection,

    @Inject(MONGO_WRITE_CONNECTION)
    private mongoWriteConnection: MongoConnection,

    @Inject(MONGO_READ_CONNECTION)
    private mongoReadConnection: MongoConnection,

    @Inject(REDIS_CONNECTION)
    private redisConnection: RedisConnection,
    
    @Inject(KAFKA_CONNECTION)
    private kafkaConnection: KafkaConnection
  ) {}

  async beforeApplicationShutdown() {
    console.log("Shutting down gracefully...");

    const results = await Promise.allSettled([
      this.postgresWriteConnection.close(),
      this.postgresReadConnection.close(),
      this.mongoWriteConnection.close(),
      this.mongoReadConnection.close(),
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