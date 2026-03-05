import express from "express";
import { MongoClient } from "mongodb";
import { Kafka } from "kafkajs";
import Stripe from "stripe";
import { buildPaymentRouter } from "./adapters/inbound/http/payment-controller.js";
import { MongoPaymentRepository } from "./adapters/outbound/mongodb/payment-repository.js";
import { StripeGateway } from "./adapters/outbound/stripe/stripe-gateway.js";
import { KafkaEventBus } from "./adapters/outbound/kafka/event-bus.js";
import { OTelTelemetry } from "./adapters/outbound/telemetry/otel-telemetry.js";
import { CreatePaymentUseCase } from "./application/create-payment.js";
import { config } from "./infrastructure/config.js";
import { startTelemetry } from "./infrastructure/telemetry.js";

async function bootstrap() {
  startTelemetry("payments-service", config.otelEndpoint);

  const mongo = new MongoClient(config.mongoUri);
  await mongo.connect();
  const collection = mongo.db(config.dbName).collection("payments");

  const kafka = new Kafka({
    clientId: `${config.kafkaClientId}-payments`,
    brokers: config.kafkaBrokers,
  });

  const producer = kafka.producer();
  await producer.connect();

  const consumer = kafka.consumer({ groupId: `${config.kafkaGroupId}-payments` });
  await consumer.connect();
  await consumer.subscribe({ topic: "order.created", fromBeginning: true });

  const stripe = new Stripe(config.stripeSecretKey, { apiVersion: "2024-06-20" });

  const repository = new MongoPaymentRepository(collection);
  const gateway = new StripeGateway(stripe);
  const eventBus = new KafkaEventBus(producer);
  const telemetry = new OTelTelemetry();

  const createPaymentUseCase = new CreatePaymentUseCase(
    repository,
    gateway,
    eventBus,
    telemetry,
  );

  await consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) return;
      const event = JSON.parse(message.value.toString()) as {
        payload: { orderId: string; amount: number; currency: string };
      };
      await createPaymentUseCase.execute(event.payload);
    },
  });

  const app = express();
  app.use(express.json());
  app.use(buildPaymentRouter(createPaymentUseCase));

  app.listen(config.port, () => {
    console.log(`payments service on :${config.port}`);
  });
}

bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});
