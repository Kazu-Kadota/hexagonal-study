import express from "express";
import { config } from "../../../../infrastructure/config.js";
import { CreatePaymentUseCase } from "../../../../application/create-payment.js";
import { CurrencyType, PaymentDTO } from "../../../../domain/payment.js";
import { GetPaymentUseCase } from "../../../../application/get-payment.js";
import { KafkaConnection } from "../../../../infrastructure/messaging/kafka/connection.js";
import { KafkaEventBus } from "../../../outbound/messaging/kafka/event-bus.js";
import { MongoConnection } from "../../../../infrastructure/database/mongodb/connection.js";
import { MongoPaymentRepositoryRead } from "../../../outbound/database/mongodb/read.js";
import { MongoPaymentRepositoryWrite } from "../../../outbound/database/mongodb/write.js";
import { OTelTelemetry } from "../../../outbound/telemetry/otel/otel-telemetry.js";
import { PaymentController } from "./payment-controller.js";
import { PostgresConnection } from "../../../../infrastructure/database/postgres/connection.js";
import { PostgresPaymentRepositoryRead } from "../../../outbound/database/postgres/read.js";
import { PostgresPaymentRepositoryWrite } from "../../../outbound/database/postgres/write.js";
import { RedisConnection } from "../../../../infrastructure/cache/redis/connection.js";
import { RedisPaymentCache } from "../../../outbound/cache/redis/payment-cache.js";
import { StripeConnection } from "../../../../infrastructure/payment-gateway/stripe/connection.js";
import { StripeGateway } from "../../../outbound/payment-gateway/stripe/stripe-gateway.js";

export async function bootstrapExpress() {
  const postgresWriteUrl = `postgresql://${config.database.write.user}:${config.database.write.password}@${config.database.write.host}:${config.database.write.port}/payments`;
  const postgresReadUrl = `postgresql://${config.database.read.user}:${config.database.read.password}@${config.database.read.host}:${config.database.read.port}/payments`;

  const postgresWriteConnection = new PostgresConnection(postgresWriteUrl);
  const postgresReadConnection = new PostgresConnection(postgresReadUrl);
  const mongoWriteConnection = new MongoConnection(config.database.write.uri, 'payments');
  const mongoReadConnection = new MongoConnection(config.database.read.uri, 'payments');

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
    `${config.messaging.kafka.clientId}-payments`,
    config.messaging.kafka.brokers
  );
  await kafkaConnection.connect();
  const producer = await kafkaConnection.producer();
  const consumer = await kafkaConnection.consumer(config.messaging.kafka.groupId);
  await consumer.subscribe({ topic: "order.created", fromBeginning: true });

  const stripeConnection = new StripeConnection(config.payment_gateway.stripe.secretKey);
  await stripeConnection.connect();
  const stripe = stripeConnection.getClient();


  const writeRepository = config.database.write.provider === "postgres"
    ? new PostgresPaymentRepositoryWrite(postgresWriteConnection.getClient())
    : new MongoPaymentRepositoryWrite(mongoWriteConnection.getClient().collection<PaymentDTO>('payments'));

  const readRepository = config.database.read.provider === "postgres"
    ? new PostgresPaymentRepositoryRead(postgresReadConnection.getClient())
    : new MongoPaymentRepositoryRead(mongoReadConnection.getClient().collection<PaymentDTO>('payments'));
  const cache = new RedisPaymentCache(redis);
  const eventBus = new KafkaEventBus(producer);
  const telemetry = new OTelTelemetry();
  const paymentGateway = new StripeGateway(stripe);

  const createPaymentUseCase = new CreatePaymentUseCase(
    writeRepository,
    readRepository,
    paymentGateway,
    eventBus,
    cache,
    telemetry,
  );
  
  await consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) return;
      const event = JSON.parse(message.value.toString()) as {
        payload: {
          orderId: string;
          customerId: string;
          amount: number;
          currency: CurrencyType;
          idempotencyKey: string;
        };
      };
      await createPaymentUseCase.execute(event.payload);
    },
  });

  const getPaymentUseCase = new GetPaymentUseCase(
    readRepository,
    cache,
    telemetry
  );

  const paymentController = new PaymentController(
    createPaymentUseCase,
    getPaymentUseCase
  )

  const appExpress = express();
  appExpress.use(express.json());
  appExpress.use(paymentController.buildRouter());

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