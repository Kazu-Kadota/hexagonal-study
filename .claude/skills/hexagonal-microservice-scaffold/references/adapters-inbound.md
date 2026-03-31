# Inbound Adapter Templates

Each adapters provided in service will be based on the answer of the user: will use HTTP with Nest, Express, even will use Event-Input from queues or even from gRPC methods. They call the exact same use cases — the use cases don't know which framework is calling them. The inbound adapter is responsible for:

1. Deserializing the request
2. Calling the appropriate use case
3. Serializing the response
4. Handling framework-specific error mapping (e.g. HTTP with nest)

Next, will have some examples of implementations for HTTP express and Nest using Postgres, Mongo, Kafka, OpenTelemetry and Redis, but could have paths like `adapters/inbound/<request_method>/<type>/<entity>-controller.ts`.

---

## Express inbound adapter

### Controller (`adapters/inbound/http/express/<entity>-controller.ts`)

The controller implements `IHTTPSPort` and owns a `buildRouter()` method.

```ts
import type { Request, Response, Router } from "express";
import { Router as createRouter } from "express";
import { Create<Entity>UseCase } from "../../../../application/use-cases/create-<entity>.js";
import { Get<Entity>UseCase } from "../../../../application/use-cases/get-<entity>.js";
import { Cancel<Entity>UseCase } from "../../../../application/use-cases/cancel-<entity>.js";
import { Delete<Entity>UseCase } from "../../../../application/use-cases/delete-<entity>.js";
import { IHTTPSPort } from "../../../../application/ports/inbound/http.js";
import { Create<Entity>Body, Create<Entity>Output } from "./dtos/create-<entity>.js";
import { Get<Entity>Output, Get<Entity>Params } from "./dtos/get-<entity>.js";

export class <Entity>Controller implements IHTTPSPort {
  constructor(
    private readonly create<Entity>UseCase: Create<Entity>UseCase,
    private readonly get<Entity>UseCase: Get<Entity>UseCase,
    private readonly cancel<Entity>UseCase: Cancel<Entity>UseCase,
    private readonly delete<Entity>UseCase: Delete<Entity>UseCase,
  ) {}

  async create<Entity>(body: Create<Entity>Body): Promise<Create<Entity>Output> {
    return await this.create<Entity>UseCase.execute(body);
  }

  async get<Entity>(params: Get<Entity>Params): Promise<Get<Entity>Output> {
    return await this.get<Entity>UseCase.execute(params.id);
  }

  async cancel<Entity>(params: { id: string }): Promise<void> {
    await this.cancel<Entity>UseCase.execute(params.id);
  }

  async delete<Entity>(params: { id: string }): Promise<void> {
    await this.delete<Entity>UseCase.execute(params.id);
  }

  buildRouter(): Router {
    const router = createRouter();

    router.post("/<entity>", async (req: Request, res: Response) => {
      try {
        const result = await this.create<Entity>(req.body);
        res.status(201).json(result);
      } catch (error) {
        res.status(500).json({ error: "Internal server error" });
      }
    });

    router.get("/<entity>/:id", async (req: Request, res: Response) => {
      try {
        const result = await this.get<Entity>(req.params as Get<Entity>Params);
        res.status(200).json(result);
      } catch (error) {
        if (error instanceof Error && error.message === "<Entity> not found") {
          res.status(404).json({ error: "<Entity> not found" });
          return;
        }
        res.status(500).json({ error: "Internal server error" });
      }
    });

    router.put("/<entity>/:id/cancel", async (req: Request, res: Response) => {
      try {
        await this.cancel<Entity>(req.params);
        res.status(200).send();
      } catch (error) {
        if (error instanceof Error && error.message === "<Entity> not found") {
          res.status(404).json({ error: "<Entity> not found" });
          return;
        }
        res.status(500).json({ error: "Internal server error" });
      }
    });

    router.delete("/<entity>/:id", async (req: Request, res: Response) => {
      try {
        await this.delete<Entity>(req.params);
        res.status(204).send();
      } catch (error) {
        if (error instanceof Error && error.message === "<Entity> not found") {
          res.status(404).json({ error: "<Entity> not found" });
          return;
        }
        res.status(500).json({ error: "Internal server error" });
      }
    });

    return router;
  }
}
```

### Bootstrap / composition root (`adapters/inbound/http/express/bootstrap.ts`)

This is the only place where concrete adapters are instantiated. Think of it as `main()` for the service.

```ts
import express from "express";
import { config } from "../../../../infrastructure/config.js";
import { <Entity>DTO } from "../../../../domain/<entity>.js";
import { MongoConnection } from "../../../../infrastructure/database/mongodb/connection.js";
import { PostgresConnection } from "../../../../infrastructure/database/postgres/connection.js";
import { RedisConnection } from "../../../../infrastructure/cache/redis/connection.js";
import { KafkaConnection } from "../../../../infrastructure/messaging/kafka/connection.js";
import { Mongo<Entity>RepositoryRead } from "../../../outbound/database/mongodb/read.js";
import { Mongo<Entity>RepositoryWrite } from "../../../outbound/database/mongodb/write.js";
import { Postgres<Entity>RepositoryRead } from "../../../outbound/database/postgres/read.js";
import { Postgres<Entity>RepositoryWrite } from "../../../outbound/database/postgres/write.js";
import { Redis<Entity>Cache } from "../../../outbound/cache/redis/<entity>-cache.js";
import { KafkaEventBus } from "../../../outbound/messaging/kafka/event-bus.js";
import { OTelTelemetry } from "../../../outbound/telemetry/otel/otel-telemetry.js";
import { Create<Entity>UseCase } from "../../../../application/use-cases/create-<entity>.js";
import { Get<Entity>UseCase } from "../../../../application/use-cases/get-<entity>.js";
import { Cancel<Entity>UseCase } from "../../../../application/use-cases/cancel-<entity>.js";
import { Delete<Entity>UseCase } from "../../../../application/use-cases/delete-<entity>.js";
import { <Entity>Controller } from "./<entity>-controller.js";

export async function bootstrapExpress() {
  const postgresWriteUrl = `postgresql://${config.database.write.user}:${config.database.write.password}@${config.database.write.host}:${config.database.write.port}/<domain>`;
  const postgresReadUrl = `postgresql://${config.database.read.user}:${config.database.read.password}@${config.database.read.host}:${config.database.read.port}/<domain>`;

  const postgresWriteConnection = new PostgresConnection(postgresWriteUrl);
  const postgresReadConnection = new PostgresConnection(postgresReadUrl);
  const mongoWriteConnection = new MongoConnection(config.database.write.uri, "<domain>");
  const mongoReadConnection = new MongoConnection(config.database.read.uri, "<domain>");

  if (config.database.write.provider === "postgres") await postgresWriteConnection.connect();
  else await mongoWriteConnection.connect();

  if (config.database.read.provider === "postgres") await postgresReadConnection.connect();
  else await mongoReadConnection.connect();

  const redisConnection = new RedisConnection(config.cache.redis.url);
  const redis = redisConnection.connect();

  const kafkaConnection = new KafkaConnection(
    `${config.messaging.kafka.clientId}-<domain>`,
    config.messaging.kafka.brokers,
  );
  await kafkaConnection.connect();
  const producer = await kafkaConnection.producer();

  const writeRepository =
    config.database.write.provider === "postgres"
      ? new Postgres<Entity>RepositoryWrite(postgresWriteConnection.getClient())
      : new Mongo<Entity>RepositoryWrite(mongoWriteConnection.getClient().collection<<Entity>DTO>("<domain>"));

  const readRepository =
    config.database.read.provider === "postgres"
      ? new Postgres<Entity>RepositoryRead(postgresReadConnection.getClient())
      : new Mongo<Entity>RepositoryRead(mongoReadConnection.getClient().collection<<Entity>DTO>("<domain>"));

  const cache = new Redis<Entity>Cache(redis);
  const eventBus = new KafkaEventBus(producer);
  const telemetry = new OTelTelemetry();

  const create<Entity>UseCase = new Create<Entity>UseCase(writeRepository, cache, eventBus, telemetry);
  const get<Entity>UseCase = new Get<Entity>UseCase(readRepository, cache, telemetry);
  const cancel<Entity>UseCase = new Cancel<Entity>UseCase(readRepository, writeRepository, cache, eventBus, telemetry);
  const delete<Entity>UseCase = new Delete<Entity>UseCase(writeRepository, cache, eventBus, telemetry);

  const controller = new <Entity>Controller(
    create<Entity>UseCase,
    get<Entity>UseCase,
    cancel<Entity>UseCase,
    delete<Entity>UseCase,
  );

  const app = express();
  app.use(express.json());
  app.use(controller.buildRouter());

  const server = app.listen(config.app.port, () => {
    console.log(`${config.app.name} service on :${config.app.port}`);
  });

  let shuttingDown = false;

  async function shutdown(signal: string) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`Received ${signal}. Starting graceful shutdown...`);

    server.close(async (serverError) => {
      if (serverError) console.error("Error while closing HTTP server:", serverError);

      const results = await Promise.allSettled([
        postgresWriteConnection.close(),
        postgresReadConnection.close(),
        mongoWriteConnection.close(),
        mongoReadConnection.close(),
        redisConnection.close(),
        kafkaConnection.close(),
      ]);

      for (const result of results) {
        if (result.status === "rejected") console.error("Shutdown error:", result.reason);
      }

      console.log("Graceful shutdown completed.");
      process.exit(serverError ? 1 : 0);
    });

    setTimeout(() => { console.error("Forced shutdown after timeout."); process.exit(1); }, 10000).unref();
  }

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}
```

---

## NestJS inbound adapter

### Injection tokens (`adapters/inbound/http/nest/token.ts`)

One Symbol per injectable. These are the NestJS DI tokens.

```ts
export const WRITE_<ENTITY>_REPOSITORY = Symbol("WRITE_<ENTITY>_REPOSITORY");
export const READ_<ENTITY>_REPOSITORY = Symbol("READ_<ENTITY>_REPOSITORY");

export const POSTGRES_WRITE_CONNECTION = Symbol("POSTGRES_WRITE_CONNECTION");
export const POSTGRES_WRITE_PRISMA_CLIENT = Symbol("POSTGRES_WRITE_PRISMA_CLIENT");
export const POSTGRES_READ_CONNECTION = Symbol("POSTGRES_READ_CONNECTION");
export const POSTGRES_READ_PRISMA_CLIENT = Symbol("POSTGRES_READ_PRISMA_CLIENT");

export const MONGO_READ_CONNECTION = Symbol("MONGO_READ_CONNECTION");
export const MONGO_READ_COLLECTION = Symbol("MONGO_READ_COLLECTION");
export const MONGO_WRITE_CONNECTION = Symbol("MONGO_WRITE_CONNECTION");
export const MONGO_WRITE_COLLECTION = Symbol("MONGO_WRITE_COLLECTION");

export const REDIS_CONNECTION = Symbol("REDIS_CONNECTION");
export const <ENTITY>_CACHE = Symbol("<ENTITY>_CACHE");

export const KAFKA_CONNECTION = Symbol("KAFKA_CONNECTION");
export const KAFKA_PRODUCER = Symbol("KAFKA_PRODUCER");

export const EVENT_BUS = Symbol("EVENT_BUS");
export const TELEMETRY = Symbol("TELEMETRY");
```

### Service (`adapters/inbound/http/nest/<entity>.service.ts`)

Thin service layer — delegates directly to use cases.

```ts
import { Inject, Injectable } from "@nestjs/common";
import { Create<Entity>UseCase } from "../../../../application/use-cases/create-<entity>.js";
import { Get<Entity>UseCase } from "../../../../application/use-cases/get-<entity>.js";
import { Cancel<Entity>UseCase } from "../../../../application/use-cases/cancel-<entity>.js";
import { Delete<Entity>UseCase } from "../../../../application/use-cases/delete-<entity>.js";
import { <Entity>DTO } from "../../../../domain/<entity>.js";

@Injectable()
export class <Entity>Service {
  constructor(
    @Inject(Create<Entity>UseCase) private readonly create<Entity>UseCase: Create<Entity>UseCase,
    @Inject(Get<Entity>UseCase) private readonly get<Entity>UseCase: Get<Entity>UseCase,
    @Inject(Cancel<Entity>UseCase) private readonly cancel<Entity>UseCase: Cancel<Entity>UseCase,
    @Inject(Delete<Entity>UseCase) private readonly delete<Entity>UseCase: Delete<Entity>UseCase,
  ) {}

  async create<Entity>(input: { /* ...params */ }): Promise<<Entity>DTO> {
    return await this.create<Entity>UseCase.execute(input);
  }

  async get<Entity>(id: string): Promise<<Entity>DTO> {
    return await this.get<Entity>UseCase.execute(id);
  }

  async cancel<Entity>(id: string): Promise<void> {
    await this.cancel<Entity>UseCase.execute(id);
  }

  async delete<Entity>(id: string): Promise<void> {
    await this.delete<Entity>UseCase.execute(id);
  }
}
```

### Module (`adapters/inbound/http/nest/<entity>.module.ts`)

The module is the NestJS equivalent of the Express bootstrap — it wires all providers using factory functions.

The structure mirrors the Express bootstrap exactly: connections → adapters → use cases.

```ts
import { Module } from "@nestjs/common";
import { config } from "../../../../infrastructure/config.js";
// ... import all connection classes, adapters, use cases, and ports
import { <Entity>Controller } from "./<entity>.controller.js";
import { <Entity>Service } from "./<entity>.service.js";
import { ClientShutdownService } from "./infra/client-shutdown.service.js";
import {
  EVENT_BUS, KAFKA_CONNECTION, KAFKA_PRODUCER,
  MONGO_READ_COLLECTION, MONGO_READ_CONNECTION,
  MONGO_WRITE_COLLECTION, MONGO_WRITE_CONNECTION,
  POSTGRES_READ_CONNECTION, POSTGRES_READ_PRISMA_CLIENT,
  POSTGRES_WRITE_CONNECTION, POSTGRES_WRITE_PRISMA_CLIENT,
  READ_<ENTITY>_REPOSITORY, REDIS_CONNECTION,
  <ENTITY>_CACHE, TELEMETRY, WRITE_<ENTITY>_REPOSITORY,
} from "./token.js";

@Module({
  controllers: [<Entity>Controller],
  providers: [
    <Entity>Service,
    ClientShutdownService,
    // Connections (async factories)
    { provide: POSTGRES_WRITE_CONNECTION, useFactory: async () => { /* ... */ } },
    { provide: POSTGRES_WRITE_PRISMA_CLIENT, useFactory: async (c) => config.database.write.provider === "postgres" ? c.getClient() : null, inject: [POSTGRES_WRITE_CONNECTION] },
    { provide: POSTGRES_READ_CONNECTION, useFactory: async () => { /* ... */ } },
    { provide: POSTGRES_READ_PRISMA_CLIENT, useFactory: async (c) => config.database.read.provider === "postgres" ? c.getClient() : null, inject: [POSTGRES_READ_CONNECTION] },
    { provide: MONGO_WRITE_CONNECTION, useFactory: async () => { /* ... */ } },
    { provide: MONGO_WRITE_COLLECTION, useFactory: async (c) => config.database.write.provider === "mongodb" ? c.getClient().collection("<domain>") : null, inject: [MONGO_WRITE_CONNECTION] },
    { provide: MONGO_READ_CONNECTION, useFactory: async () => { /* ... */ } },
    { provide: MONGO_READ_COLLECTION, useFactory: async (c) => config.database.read.provider === "mongodb" ? c.getClient().collection("<domain>") : null, inject: [MONGO_READ_CONNECTION] },
    { provide: REDIS_CONNECTION, useFactory: () => { const r = new RedisConnection(config.cache.redis.url); r.connect(); return r; } },
    { provide: KAFKA_CONNECTION, useFactory: async () => { const k = new KafkaConnection(`${config.messaging.kafka.clientId}-<domain>`, config.messaging.kafka.brokers); await k.connect(); return k; } },
    { provide: KAFKA_PRODUCER, useFactory: async (k) => k.producer(), inject: [KAFKA_CONNECTION] },
    // Repositories
    {
      provide: WRITE_<ENTITY>_REPOSITORY,
      useFactory: (prisma, collection) => config.database.write.provider === "postgres"
        ? new Postgres<Entity>RepositoryWrite(prisma)
        : new Mongo<Entity>RepositoryWrite(collection),
      inject: [POSTGRES_WRITE_PRISMA_CLIENT, MONGO_WRITE_COLLECTION],
    },
    {
      provide: READ_<ENTITY>_REPOSITORY,
      useFactory: (prisma, collection) => config.database.read.provider === "postgres"
        ? new Postgres<Entity>RepositoryRead(prisma)
        : new Mongo<Entity>RepositoryRead(collection),
      inject: [POSTGRES_READ_PRISMA_CLIENT, MONGO_READ_COLLECTION],
    },
    // Cache, event bus, telemetry
    { provide: <ENTITY>_CACHE, useFactory: (r) => new Redis<Entity>Cache(r.getClient()), inject: [REDIS_CONNECTION] },
    { provide: EVENT_BUS, useFactory: (p) => new KafkaEventBus(p), inject: [KAFKA_PRODUCER] },
    { provide: TELEMETRY, useFactory: () => new OTelTelemetry() },
    // Use cases
    {
      provide: Create<Entity>UseCase,
      useFactory: (wr, c, eb, t) => new Create<Entity>UseCase(wr, c, eb, t),
      inject: [WRITE_<ENTITY>_REPOSITORY, <ENTITY>_CACHE, EVENT_BUS, TELEMETRY],
    },
    {
      provide: Get<Entity>UseCase,
      useFactory: (rr, c, t) => new Get<Entity>UseCase(rr, c, t),
      inject: [READ_<ENTITY>_REPOSITORY, <ENTITY>_CACHE, TELEMETRY],
    },
    {
      provide: Cancel<Entity>UseCase,
      useFactory: (rr, wr, c, eb, t) => new Cancel<Entity>UseCase(rr, wr, c, eb, t),
      inject: [READ_<ENTITY>_REPOSITORY, WRITE_<ENTITY>_REPOSITORY, <ENTITY>_CACHE, EVENT_BUS, TELEMETRY],
    },
    {
      provide: Delete<Entity>UseCase,
      useFactory: (wr, c, eb, t) => new Delete<Entity>UseCase(wr, c, eb, t),
      inject: [WRITE_<ENTITY>_REPOSITORY, <ENTITY>_CACHE, EVENT_BUS, TELEMETRY],
    },
  ],
})
export class <Entity>Module {}
```

### Graceful shutdown service (`adapters/inbound/http/nest/infra/client-shutdown.service.ts`)

```ts
import { Injectable, OnApplicationShutdown } from "@nestjs/common";
import { Inject } from "@nestjs/common";
import { POSTGRES_WRITE_CONNECTION, POSTGRES_READ_CONNECTION, MONGO_WRITE_CONNECTION, MONGO_READ_CONNECTION, REDIS_CONNECTION, KAFKA_CONNECTION } from "../token.js";

@Injectable()
export class ClientShutdownService implements OnApplicationShutdown {
  constructor(
    @Inject(POSTGRES_WRITE_CONNECTION) private readonly postgresWrite: any,
    @Inject(POSTGRES_READ_CONNECTION) private readonly postgresRead: any,
    @Inject(MONGO_WRITE_CONNECTION) private readonly mongoWrite: any,
    @Inject(MONGO_READ_CONNECTION) private readonly mongoRead: any,
    @Inject(REDIS_CONNECTION) private readonly redis: any,
    @Inject(KAFKA_CONNECTION) private readonly kafka: any,
  ) {}

  async onApplicationShutdown(signal?: string) {
    console.log(`Received ${signal}. Closing connections...`);
    await Promise.allSettled([
      this.postgresWrite.close(),
      this.postgresRead.close(),
      this.mongoWrite.close(),
      this.mongoRead.close(),
      this.redis.close(),
      this.kafka.close(),
    ]);
  }
}
```

### NestJS bootstrap (`adapters/inbound/http/nest/bootstrap.ts`)

```ts
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { <Entity>Module } from "./<entity>.module.js";
import { config } from "../../../../infrastructure/config.js";

export async function bootstrapNest() {
  const app = await NestFactory.create(<Entity>Module);
  app.useGlobalPipes(new ValidationPipe());
  app.enableShutdownHooks();
  await app.listen(config.app.port, () => {
    console.log(`${config.app.name} service on :${config.app.port}`);
  });
}
```

---

## Messaging consumer inbound adapter (Kafka / SQS / etc.)

When a service needs to **react to events published by another service**, the consumer is an inbound adapter — it drives the application in exactly the same way an HTTP controller does, just triggered by a message instead of an HTTP request.

### Key design rules

- The consumer adapter **only parses and delegates** — no business logic inside it.
- It calls existing use cases via their `execute()` method, just like any other inbound adapter.
- No new inbound port class is needed: the use case itself is already the application boundary. Adding a `IMessageConsumerPort` between the consumer and the use case would be over-abstraction unless you have a concrete reason to swap the consumer.
- Unknown topics or malformed messages should be **logged and skipped** (dead-letter or skip-and-log), not thrown, to prevent the consumer from crashing.
- The consumer bootstrap runs alongside the HTTP bootstrap in `main.ts` — they are independent and each manages their own connections.

### Consumer adapter (`adapters/inbound/messaging/kafka/<entity>-consumer.ts`)

```ts
import type { Consumer } from "kafkajs";
import { <UseCaseA> } from "../../../../application/use-cases/<use-case-a>.js";
import { <UseCaseB> } from "../../../../application/use-cases/<use-case-b>.js";

// Extend this union as you subscribe to more topics
type KnownTopic = "<entity-a>.<event>" | "<entity-b>.<event>";

export class <Entity>KafkaConsumer {
  constructor(
    private readonly consumer: Consumer,
    private readonly <useCaseA>: <UseCaseA>,
    private readonly <useCaseB>: <UseCaseB>,
  ) {}

  async start(): Promise<void> {
    await this.consumer.subscribe({
      topics: ["<entity-a>.<event>", "<entity-b>.<event>"],
      fromBeginning: false,
    });

    await this.consumer.run({
      eachMessage: async ({ topic, message }) => {
        if (!message.value) return;

        try {
          const raw = JSON.parse(message.value.toString());

          switch (topic as KnownTopic) {
            case "<entity-a>.<event>":
              await this.<useCaseA>.execute({
                // map raw.payload fields to use case params
                id: raw.payload.<entityAId>,
              });
              break;

            case "<entity-b>.<event>":
              await this.<useCaseB>.execute({
                id: raw.payload.<entityBId>,
              });
              break;

            default:
              console.warn(`[<Entity>KafkaConsumer] Unhandled topic: ${topic}`);
          }
        } catch (error) {
          // Skip-and-log: prevents one bad message from halting the consumer.
          // For production, forward to a dead-letter queue instead.
          console.error(`[<Entity>KafkaConsumer] Failed to process message on ${topic}:`, error);
        }
      },
    });
  }
}
```

### Consumer bootstrap (`adapters/inbound/messaging/kafka/bootstrap.ts`)

This is a second composition root, parallel to the HTTP bootstrap. It creates its own connection instances (Kafka connections are cheap) and wires the same use case classes.

```ts
import { config } from "../../../../infrastructure/config.js";
import { KafkaConnection } from "../../../../infrastructure/messaging/kafka/connection.js";
// ... import other connections and adapters needed by the use cases
import { <UseCaseA> } from "../../../../application/use-cases/<use-case-a>.js";
import { <Entity>KafkaConsumer } from "./<entity>-consumer.js";

export async function bootstrapKafkaConsumer() {
  const kafkaConnection = new KafkaConnection(
    `${config.messaging.kafka.clientId}-<domain>-consumer`,
    config.messaging.kafka.brokers,
  );
  await kafkaConnection.connect();
  const consumer = await kafkaConnection.consumer("<domain>-group");

  // Wire the same adapters as the HTTP bootstrap (each bootstrap owns its connections)
  const writeRepository = /* ... */;
  const cache = /* ... */;
  const eventBus = /* ... */;
  const telemetry = /* ... */;

  const <useCaseA> = new <UseCaseA>(writeRepository, cache, eventBus, telemetry);

  const <entity>Consumer = new <Entity>KafkaConsumer(consumer, <useCaseA>);
  await <entity>Consumer.start();

  console.log(`[<domain>] Kafka consumer started`);

  // Graceful shutdown
  async function shutdown(signal: string) {
    console.log(`Received ${signal}. Disconnecting Kafka consumer...`);
    await kafkaConnection.close();
    process.exit(0);
  }

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}
```

### Wiring into `main.ts`

Run the consumer bootstrap alongside the HTTP bootstrap. They are independent — one failing should not block the other.

```ts
async function bootstrap() {
  const telemetry = new TelemetryConnection(`${config.app.name}-service`, config.telemetry.otel.endpoint);
  telemetry.start();

  await Promise.all([
    bootstrapExpress(),
    bootstrapKafkaConsumer(),  // ← add this
  ]);
}
```

If the service is **consumer-only** (no HTTP surface), omit `bootstrapExpress()` entirely and just call `bootstrapKafkaConsumer()`.

### SQS consumer variant

The shape is identical — swap `KafkaConnection` / `kafkajs.Consumer` for `SQSConnection` / polling loop:

```ts
// adapters/inbound/messaging/sqs/<entity>-consumer.ts
import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } from "@aws-sdk/client-sqs";

export class <Entity>SQSConsumer {
  private running = false;

  constructor(
    private readonly sqs: SQSClient,
    private readonly queueUrl: string,
    private readonly <useCase>: <UseCase>,
  ) {}

  async start(): Promise<void> {
    this.running = true;
    console.log(`[<Entity>SQSConsumer] Polling ${this.queueUrl}`);

    while (this.running) {
      const response = await this.sqs.send(new ReceiveMessageCommand({
        QueueUrl: this.queueUrl,
        MaxNumberOfMessages: 10,
        WaitTimeSeconds: 20,   // long-polling
      }));

      for (const message of response.Messages ?? []) {
        try {
          const body = JSON.parse(message.Body ?? "{}");
          await this.<useCase>.execute({ id: body.payload.<entityId> });
          // Delete only after successful processing
          await this.sqs.send(new DeleteMessageCommand({
            QueueUrl: this.queueUrl,
            ReceiptHandle: message.ReceiptHandle!,
          }));
        } catch (error) {
          console.error(`[<Entity>SQSConsumer] Failed to process message:`, error);
          // Leave message in queue — it will become visible again after visibility timeout
        }
      }
    }
  }

  stop(): void {
    this.running = false;
  }
}
```
