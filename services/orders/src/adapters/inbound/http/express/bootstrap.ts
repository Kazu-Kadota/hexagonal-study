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

export async function bootstrapExpress() {
  const mongo = new MongoClient(config.mongoUri);
  await mongo.connect();
  const collection = mongo.db(config.dbName).collection<Order>("orders");

  const redis = new Redis(config.redisUrl);

  const kafka = new Kafka({
    clientId: `${config.kafkaClientId}-orders`,
    brokers: config.kafkaBrokers,
  });
  const producer = kafka.producer();
  await producer.connect();

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

  appExpress.listen(config.port, () => {
    console.log(`orders service on :${config.port}`);
  });
}