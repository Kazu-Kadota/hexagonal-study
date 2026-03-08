import "dotenv/config";

export const config = {
  service: "orders",
  framework: process.env.FRAMEWORK ?? "express",
  port: Number(process.env.ORDERS_PORT ?? 3001),
  mongoUri: process.env.MONGO_URI ?? "mongodb://localhost:27017",
  dbName: process.env.ORDERS_DB_NAME ?? "orders_db",
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
  kafkaBrokers: (process.env.KAFKA_BROKERS ?? "localhost:9092").split(","),
  kafkaClientId: process.env.KAFKA_CLIENT_ID ?? "hexagonal-study",
  otelEndpoint:
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? "http://localhost:4318",
};
