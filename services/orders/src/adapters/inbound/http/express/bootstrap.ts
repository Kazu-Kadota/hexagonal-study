import express from "express";
import { MongoClient } from "mongodb";
import { config } from "../../../../infrastructure/config.js";
import { Order } from "../../../../domain/order.js";
import { Redis } from "ioredis";
import { Kafka } from "kafkajs";
import { MongoOrderRepository } from "../../../outbound/mongodb/order-repository.js";
import { RedisOrderCache } from "../../../outbound/redis/order-cache.js";
import { KafkaEventBus } from "../../../outbound/kafka/event-bus.js";
import { OTelTelemetry } from "../../../outbound/telemetry/otel-telemetry.js";
import { CreateOrderUseCase } from "../../../../application/create-order.js";
import { GetOrderUseCase } from "../../../../application/get-order.js";
import { CancelOrderUseCase } from "../../../../application/cancel-order.js";
import { DeleteOrderUseCase } from "../../../../application/delete-order.js";
import { buildOrderRouter } from "./order-controller.js";
import { MongoConnection } from "../../../outbound/mongodb/infra/connection.js";
import { RedisConnection } from "../../../outbound/redis/infra/connection.js";
import { KafkaConnection } from "../../../outbound/kafka/infra/connection.js";

export async function bootstrapExpress() {
  const mongo = new MongoConnection(config.mongoUri, config.dbName);
  await mongo.connect();
  const collection = mongo.getCollection<Order>(config.service);

  const redisConnection = new RedisConnection(config.redisUrl)
  const redis = redisConnection.connect();

  const kafka = await new KafkaConnection(
    `${config.kafkaClientId}-${config.service}`,
    config.kafkaBrokers
  ).connect();
  const producer = kafka.producer();

  const repository = new MongoOrderRepository(collection);
  const cache = new RedisOrderCache(redis);
  const eventBus = new KafkaEventBus(producer);
  const telemetry = new OTelTelemetry();

  const createOrderUseCase = new CreateOrderUseCase(
    repository,
    cache,
    eventBus,
    telemetry,
  );
  const getOrderUseCase = new GetOrderUseCase(repository, cache, telemetry);
  const cancelOrderUseCase = new CancelOrderUseCase(repository, cache, eventBus, telemetry);
  const deleteOrderUseCase = new DeleteOrderUseCase(repository, cache, eventBus, telemetry);

  const appExpress = express();
  appExpress.use(express.json());
  appExpress.use(buildOrderRouter(
    createOrderUseCase,
    getOrderUseCase,
    cancelOrderUseCase,
    deleteOrderUseCase
  ));

  const server = appExpress.listen(config.port, () => {
    console.log(`${config.service} service on :${config.port}`);
  });

  let shuttingDown = false;

  async function shutdown(signal: string) {
    telemetry.span("shutdown", async () => {
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
        mongo.close(),
        redisConnection.close(),
        producer.disconnect(),
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