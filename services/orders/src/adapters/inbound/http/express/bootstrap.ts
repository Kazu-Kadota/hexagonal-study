import express from "express";
import { config } from "../../../../infrastructure/config.js";
import { OrderDTO } from "../../../../entity/order/order.js";
import { MongoOrderRepositoryRead } from "../../../outbound/database/mongodb/read.js";
import { RedisOrderCache } from "../../../outbound/cache/redis/order-cache.js";
import { KafkaEventBus } from "../../../outbound/messaging/kafka/event-bus.js";
import { OTelTelemetry } from "../../../outbound/telemetry/otel/otel-telemetry.js";
import { CreateOrderUseCase } from "../../../../application/use-cases/create-order.js";
import { GetOrderUseCase } from "../../../../application/use-cases/get-order.js";
import { CancelOrderUseCase } from "../../../../application/use-cases/cancel-order.js";
import { DeleteOrderUseCase } from "../../../../application/use-cases/delete-order.js";
import { OrderController } from "./order-controller.js";
import { MongoConnection } from "../../../../infrastructure/database/mongodb/connection.js";
import { RedisConnection } from "../../../../infrastructure/cache/redis/connection.js";
import { KafkaConnection } from "../../../../infrastructure/messaging/kafka/connection.js";
import { PostgresConnection } from "../../../../infrastructure/database/postgres/connection.js";
import { PostgresOrderRepositoryWrite } from "../../../outbound/database/postgres/write.js";
import { MongoOrderRepositoryWrite } from "../../../outbound/database/mongodb/write.js";
import { PostgresOrderRepositoryRead } from "../../../outbound/database/postgres/read.js";

export async function bootstrapExpress() {
  const postgresWriteUrl = `postgresql://${config.database.write.user}:${config.database.write.password}@${config.database.write.host}:${config.database.write.port}/orders`;
  const postgresReadUrl = `postgresql://${config.database.read.user}:${config.database.read.password}@${config.database.read.host}:${config.database.read.port}/orders`;

  const postgresWriteConnection = new PostgresConnection(postgresWriteUrl);
  const postgresReadConnection = new PostgresConnection(postgresReadUrl);
  const mongoWriteConnection = new MongoConnection(config.database.write.uri, 'orders');
  const mongoReadConnection = new MongoConnection(config.database.read.uri, 'orders');

  if (config.database.write.provider === "postgres") {
    await postgresWriteConnection.connect();
  } else {
    await mongoWriteConnection.connect();
  }

  
  if (config.database.read.provider === "postgres") {
    await postgresReadConnection.connect();
  } else {
    await mongoReadConnection.connect();
  }

  const redisConnection = new RedisConnection(config.cache.redis.url)
  const redis = redisConnection.connect();

  const kafkaConnection = new KafkaConnection(
    `${config.messaging.kafka.clientId}-orders`,
    config.messaging.kafka.brokers
  );
  await kafkaConnection.connect();
  const producer = await kafkaConnection.producer();

  const writeRepository = config.database.write.provider === "postgres"
    ? new PostgresOrderRepositoryWrite(postgresWriteConnection.getClient())
    : new MongoOrderRepositoryWrite(mongoWriteConnection.getClient().collection<OrderDTO>('orders'));

  const readRepository = config.database.read.provider === "postgres"
    ? new PostgresOrderRepositoryRead(postgresReadConnection.getClient())
    : new MongoOrderRepositoryRead(mongoReadConnection.getClient().collection<OrderDTO>('orders'));
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

  const orderController = new OrderController(
    createOrderUseCase,
    getOrderUseCase,
    cancelOrderUseCase,
    deleteOrderUseCase,
  )

  const appExpress = express();
  appExpress.use(express.json());
  appExpress.use(orderController.buildRouter());

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
        postgresWriteConnection.close(),
        postgresReadConnection.close(),
        mongoWriteConnection.close(),
        mongoReadConnection.close(),
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