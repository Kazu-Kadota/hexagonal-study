import express from "express";
import { config } from "../../../../infrastructure/config.js";
import { KafkaEventBus } from "../../../outbound/kafka/event-bus.js";
import { OTelTelemetry } from "../../../outbound/telemetry/otel-telemetry.js";
import { MongoConnection } from "../../../outbound/mongodb/infra/connection.js";
import { RedisConnection } from "../../../outbound/redis/infra/connection.js";
import { KafkaConnection } from "../../../outbound/kafka/infra/connection.js";
import { Payment } from "../../../../domain/payment.js";
import { StripeConnection } from "../../../outbound/stripe/infra/connection.js";
import { MongoPaymentRepository } from "../../../outbound/mongodb/payment-repository.js";
import { RedisPaymentCache } from "../../../outbound/redis/payment-cache.js";
import { StripeGateway } from "../../../outbound/stripe/stripe-gateway.js";
import { CreatePaymentUseCase } from "../../../../application/create-payment.js";
import { UUID } from "crypto";
import { GetPaymentUseCase } from "../../../../application/get-payment.js";
import { buildPaymentRouter } from "./payment-controller.js";

export async function bootstrapExpress() {
  const mongoConnection = new MongoConnection(config.mongoUri, config.dbName);
  await mongoConnection.connect();
  const collection = mongoConnection.getCollection<Payment>(config.service);

  const redisConnection = new RedisConnection(config.redisUrl)
  const redis = redisConnection.connect();

  const kafkaConnection = new KafkaConnection(
    `${config.kafkaClientId}-${config.service}`,
    config.kafkaBrokers
  );
  await kafkaConnection.connect();
  const producer = await kafkaConnection.producer();
  const consumer = await kafkaConnection.consumer(config.kafkaGroupId);
  await consumer.subscribe({ topic: "order.created", fromBeginning: true });

  const stripeConnection = new StripeConnection(config.stripeSecretKey);
  const stripe = stripeConnection.connect();

  const repository = new MongoPaymentRepository(collection);
  const cache = new RedisPaymentCache(redis);
  const eventBus = new KafkaEventBus(producer);
  const telemetry = new OTelTelemetry();
  const gateway = new StripeGateway(stripe);

  const createPaymentUseCase = new CreatePaymentUseCase(
    repository,
    gateway,
    eventBus,
    cache,
    telemetry,
  );

  const getPaymentUseCase = new GetPaymentUseCase(
    repository,
    cache,
    telemetry
  );
  
  await consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) return;
      const event = JSON.parse(message.value.toString()) as {
        payload: {
          orderId: string;
          customerId: string;
          amount: number;
          currency: string;
          idempotencyKey: UUID;
        };
      };
      await createPaymentUseCase.execute(event.payload);
    },
  });

  const appExpress = express();
  appExpress.use(express.json());
  appExpress.use(buildPaymentRouter(
    createPaymentUseCase,
    getPaymentUseCase
  ));

  const server = appExpress.listen(config.port, () => {
    console.log(`${config.service} service on :${config.port}`);
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