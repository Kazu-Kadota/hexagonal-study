import express from "express";
import { config } from "../../../../infrastructure/config.js";
import { Order } from "../../../../domain/order.js";
import { MongoOrderRepositoryRead } from "../../../outbound/database/mongodb/read.js";
import { RedisOrderCache } from "../../../outbound/cache/redis/order-cache.js";
import { KafkaEventBus } from "../../../outbound/messaging/kafka/event-bus.js";
import { OTelTelemetry } from "../../../outbound/telemetry/otel/otel-telemetry.js";
import { CreateOrderUseCase } from "../../../../application/create-order.js";
import { GetOrderUseCase } from "../../../../application/get-order.js";
import { CancelOrderUseCase } from "../../../../application/cancel-order.js";
import { DeleteOrderUseCase } from "../../../../application/delete-order.js";
import { buildOrderRouter } from "./order-controller.js";
import { MongoConnection } from "../../../../infrastructure/database/mongodb/connection.js";
import { RedisConnection } from "../../../../infrastructure/cache/redis/connection.js";
import { KafkaConnection } from "../../../../infrastructure/messaging/kafka/connection.js";
import { PostgresConnection } from "../../../../infrastructure/database/postgres/connection.js";
import { PostgresOrderRepositoryWrite } from "../../../outbound/database/postgres/write.js";

export async function bootstrapExpress() {
  const postgresUrl = `postgresql://${config.database.write.user}:${config.database.write.password}@${config.database.write.host}:${config.database.write.port}/orders`;
  const postgresConnection = new PostgresConnection(postgresUrl)
  await postgresConnection.connect();
  const prismaClient = postgresConnection.getClient();

  const mongoConnection = new MongoConnection(config.database.read.uri, 'orders');
  await mongoConnection.connect();
  const collection = mongoConnection.getClient().collection<Order>('orders');

  const redisConnection = new RedisConnection(config.cache.redis.url)
  const redis = redisConnection.connect();

  const kafkaConnection = new KafkaConnection(
    `${config.messaging.kafka.clientId}-orders`,
    config.messaging.kafka.brokers
  );
  await kafkaConnection.connect();
  const producer = await kafkaConnection.producer();

  const writeRepository = new PostgresOrderRepositoryWrite(prismaClient);
  const readRepository = new MongoOrderRepositoryRead(collection);
  const cache = new RedisOrderCache(redis);
  const eventBus = new KafkaEventBus(producer);
  const telemetry = new OTelTelemetry();

  const createOrderUseCase = new CreateOrderUseCase(
    writeRepository,
    cache,
    eventBus,
    telemetry,
  );
  const getOrderUseCase = new GetOrderUseCase(
    readRepository,
    cache,
    telemetry
  );
  const cancelOrderUseCase = new CancelOrderUseCase(
    readRepository,
    writeRepository,
    cache,
    eventBus,
    telemetry
  );
  const deleteOrderUseCase = new DeleteOrderUseCase(
    writeRepository,
    cache,
    eventBus,
    telemetry
  );

  const appExpress = express();
  appExpress.use(express.json());
  appExpress.use(buildOrderRouter(
    createOrderUseCase,
    getOrderUseCase,
    cancelOrderUseCase,
    deleteOrderUseCase
  ));

  const server = appExpress.listen(config.app.port, () => {
    console.log(`${config.app.name} service on :${config.app.port}`);
  });

  let shuttingDown = false;

  async function shutdown(signal: string) {
    await telemetry.span("shutdown", async () => {
      await performShutdown(signal);
    });
  }

  async function performShutdown(signal: string) {
    if (shuttingDown) return;
    shuttingDown = true;

    console.log(`Received ${signal}. Starting graceful shutdown...`);

    server.close(async (serverError) => {
      if (serverError) {
        console.error("Error while closing HTTP server:", serverError);
      }

      const results = await Promise.allSettled([
        postgresConnection.close(),
        mongoConnection.close(),
        redisConnection.close(),
        kafkaConnection.close(),
      ]);

      for (const result of results) {
        if (result.status === "rejected") {
          console.error("Shutdown error:", result.reason);
        }
      }

      console.log("Graceful shutdown completed.");
      process.exit(serverError ? 1 : 0);
    });

    setTimeout(() => {
      console.error("Forced shutdown after timeout.");
      process.exit(1);
    }, 10000).unref();
  }

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}