import "dotenv/config";

export const config = {
  port: Number(process.env.PAYMENTS_PORT ?? 3002),
  mongoUri: process.env.MONGO_URI ?? "mongodb://localhost:27017",
  dbName: process.env.PAYMENTS_DB_NAME ?? "payments_db",
  kafkaBrokers: (process.env.KAFKA_BROKERS ?? "localhost:9092").split(","),
  kafkaClientId: process.env.KAFKA_CLIENT_ID ?? "hexagonal-study",
  kafkaGroupId: process.env.KAFKA_GROUP_ID ?? "hexagonal-study-group",
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? "",
  stripeCurrency: process.env.STRIPE_CURRENCY ?? "usd",
  otelEndpoint:
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? "http://localhost:4318",
};
