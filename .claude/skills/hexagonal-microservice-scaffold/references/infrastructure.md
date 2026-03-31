# Infrastructure Layer Templates

The infrastructure layer contains connection classes (for databases, cache, messaging, telemetry and others technologies/providers) and the centralized config module. Nothing here contains business logic.

The configuration file depends of the preferences of the user. Be concise in creating this file to adapt to each choices.

---

## Abstract connection ports

### Database connection port (`infrastructure/database/ports.ts`)

```ts
export abstract class RepositoryConnectionPort {
  abstract connect(): Promise<void>;
  abstract isHealthy(): Promise<boolean>;
  abstract close(): Promise<void>;
  abstract getClient(): unknown;
}
```

### Messaging connection port (`infrastructure/messaging/port.ts`)

```ts
export abstract class MessagingConnectionPort {
  abstract connect(): Promise<unknown>;
  abstract close(): Promise<void>;
  abstract getClient(): unknown;
  abstract producer(): Promise<unknown>;
  abstract consumer(name: string): Promise<unknown>;
}
```

### Cache connection port (`infrastructure/cache/ports.ts`)

```ts
import { Redis } from "ioredis";

export abstract class CacheConnectionPort {
  abstract connect(): Redis;
  abstract close(): Promise<void>;
  abstract getClient(): Redis;
}
```

### Telemetry connection port (`infrastructure/telemetry/ports.ts`)

```ts
export abstract class TelemetryConnectionPort {
  abstract start(): void;
}
```

---

## Connection implementations

### Postgres connection (`infrastructure/database/postgres/connection.ts`)

```ts
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../../generated/<domain>/client.js";
import { RepositoryConnectionPort } from "../ports.js";

export class PostgresConnection implements RepositoryConnectionPort {
  private client: PrismaClient | null = null;

  constructor(private readonly url: string) {}

  async connect(): Promise<void> {
    if (this.client) return;
    const adapter = new PrismaPg({ connectionString: this.url });
    this.client = new PrismaClient({ adapter });
    await this.client.$connect();
  }

  async isHealthy(): Promise<boolean> {
    if (!this.client) return false;
    try {
      await this.client.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  async close(): Promise<void> {
    if (!this.client) return;
    await this.client.$disconnect();
    this.client = null;
  }

  getClient(): PrismaClient {
    if (!this.client) throw new Error("PostgresConnection is not connected");
    return this.client;
  }
}
```

### MongoDB connection (`infrastructure/database/mongodb/connection.ts`)

```ts
import { MongoClient, Db, MongoClientOptions } from "mongodb";
import { RepositoryConnectionPort } from "../ports.js";

export class MongoConnection implements RepositoryConnectionPort {
  private client: MongoClient | null = null;
  private db: Db | null = null;

  constructor(
    private readonly uri: string,
    private readonly dbName: string,
    private readonly options?: MongoClientOptions,
  ) {}

  async connect(): Promise<void> {
    if (this.client) return;
    this.client = new MongoClient(this.uri, this.options);
    await this.client.connect();
    this.db = this.client.db(this.dbName);
  }

  async isHealthy(): Promise<boolean> {
    if (!this.client) return false;
    try {
      await this.client.db(this.dbName).command({ ping: 1 });
      return true;
    } catch {
      return false;
    }
  }

  async close(): Promise<void> {
    if (!this.client) return;
    await this.client.close();
    this.client = null;
  }

  getClient(): Db {
    if (!this.db) throw new Error("MongoConnection is not connected");
    return this.db;
  }
}
```

### Redis connection (`infrastructure/cache/redis/connection.ts`)

```ts
import { Redis } from "ioredis";
import { CacheConnectionPort } from "../ports.js";

export class RedisConnection implements CacheConnectionPort {
  private client: Redis | null = null;

  constructor(private readonly url: string) {}

  connect(): Redis {
    if (this.client) return this.client;
    this.client = new Redis(this.url);
    return this.client;
  }

  async close(): Promise<void> {
    if (!this.client) return;
    await this.client.quit();
    this.client = null;
  }

  getClient(): Redis {
    if (!this.client) throw new Error("RedisConnection is not connected");
    return this.client;
  }
}
```

### Kafka connection (`infrastructure/messaging/kafka/connection.ts`)

```ts
import { Consumer, Kafka, Producer } from "kafkajs";
import { MessagingConnectionPort } from "../port.js";

export class KafkaConnection implements MessagingConnectionPort {
  private client: Kafka | null = null;
  private connectedProducer: Producer | null = null;
  private connectedConsumers: Consumer[] = [];

  constructor(
    private readonly clientId: string,
    private readonly brokers: string[],
  ) {}

  async connect(): Promise<Kafka> {
    if (this.client) return this.client;
    this.client = new Kafka({ brokers: this.brokers, clientId: this.clientId });
    return this.client;
  }

  async close(): Promise<void> {
    if (!this.client) return;
    const ops: Promise<unknown>[] = [];
    if (this.connectedProducer) {
      ops.push(this.connectedProducer.disconnect());
      this.connectedProducer = null;
    }
    if (this.connectedConsumers.length) {
      ops.push(...this.connectedConsumers.map((c) => c.disconnect()));
      this.connectedConsumers = [];
    }
    await Promise.allSettled(ops);
    this.client = null;
  }

  getClient(): Kafka {
    if (!this.client) throw new Error("Kafka Client is not set");
    return this.client;
  }

  async producer(): Promise<Producer> {
    if (!this.client) throw new Error("KafkaConnection is not connected");
    if (this.connectedProducer) return this.connectedProducer;
    const producer = this.client.producer();
    await producer.connect();
    this.connectedProducer = producer;
    return producer;
  }

  async consumer(name: string): Promise<Consumer> {
    if (!this.client) throw new Error("KafkaConnection is not connected");
    const consumer = this.client.consumer({ groupId: `${this.clientId}-${name}` });
    await consumer.connect();
    this.connectedConsumers.push(consumer);
    return consumer;
  }
}
```

### OpenTelemetry connection (`infrastructure/telemetry/otel/connection.ts`)

```ts
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { BasicTracerProvider, BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { ATTR_SERVICE_NAME, ATTR_SERVICE_NAMESPACE, ATTR_SERVICE_VERSION } from "@opentelemetry/semantic-conventions";
import { trace } from "@opentelemetry/api";
import { TelemetryConnectionPort } from "../ports.js";

export class TelemetryConnection implements TelemetryConnectionPort {
  constructor(
    private readonly serviceName: string,
    private readonly endpoint: string,
  ) {}

  start(): void {
    const resource = resourceFromAttributes({
      [ATTR_SERVICE_NAME]: this.serviceName,
      [ATTR_SERVICE_VERSION]: "1.0.0",
      [ATTR_SERVICE_NAMESPACE]: this.serviceName,
    });

    const provider = new BasicTracerProvider({
      resource,
      spanProcessors: [new BatchSpanProcessor(new OTLPTraceExporter({ url: `${this.endpoint}/v1/traces` }))],
    });

    trace.setGlobalTracerProvider(provider);
  }
}
```

---

## Config (`infrastructure/config.ts`)

Zod validates all env vars at startup. `process.env` is **never** accessed outside this file.

```ts
import z from "zod";

const schema = z.object({
  app: z.object({
    name: z.literal("<domain>"),
    port: z.coerce.number().int().positive().default(3001),
  }),
  cache: z.object({
    redis: z.object({
      url: z.string().default("redis://localhost:6379"),
    }),
  }),
  database: z.object({
    write: z.object({
      provider: z.enum(["postgres", "mongodb"]).default("postgres"),
      host: z.string().default("localhost"),
      port: z.coerce.number().int().positive().default(5432),
      user: z.string().default("postgres"),
      password: z.string().default("postgres"),
      uri: z.string().default("mongodb://localhost:27017"),
    }),
    read: z.object({
      provider: z.enum(["postgres", "mongodb"]).default("mongodb"),
      host: z.string().default("localhost"),
      port: z.coerce.number().int().positive().default(5432),
      user: z.string().default("postgres"),
      password: z.string().default("postgres"),
      uri: z.string().default("mongodb://localhost:27017"),
    }),
  }),
  messaging: z.object({
    kafka: z.object({
      brokers: z
        .string()
        .default("localhost:9092")
        .transform((str) => str.split(",")),
      clientId: z.string().default("my-monorepo"),
    }),
  }),
  telemetry: z.object({
    otel: z.object({
      endpoint: z.string().default("http://localhost:4318"),
    }),
  }),
});

export const config = schema.parse({
  app: {
    name: "<domain>",
    port: process.env.<DOMAIN>_PORT ?? 3001,
  },
  cache: {
    redis: { url: process.env.REDIS_URL ?? "redis://localhost:6379" },
  },
  database: {
    write: {
      provider: process.env.<DOMAIN>_DB_WRITE_ADAPTER ?? "postgres",
      host: process.env.POSTGRES_HOST ?? "localhost",
      port: process.env.POSTGRES_PORT ?? 5432,
      user: process.env.POSTGRES_USER ?? "postgres",
      password: process.env.POSTGRES_PASSWORD ?? "postgres",
      uri: process.env.MONGO_URI ?? "mongodb://localhost:27017",
    },
    read: {
      provider: process.env.<DOMAIN>_DB_READ_ADAPTER ?? "mongodb",
      host: process.env.POSTGRES_HOST ?? "localhost",
      port: process.env.POSTGRES_PORT ?? 5432,
      user: process.env.POSTGRES_USER ?? "postgres",
      password: process.env.POSTGRES_PASSWORD ?? "postgres",
      uri: process.env.MONGO_URI ?? "mongodb://localhost:27017",
    },
  },
  messaging: {
    kafka: {
      brokers: process.env.KAFKA_BROKERS ?? "localhost:9092",
      clientId: process.env.KAFKA_CLIENT_ID ?? "my-monorepo",
    },
  },
  telemetry: {
    otel: { endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? "http://localhost:4318" },
  },
});

export type Config = z.infer<typeof schema>;
```

---

## Prisma schema template (`prisma/schema.prisma`)

```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/<domain>"
}

datasource db {
  provider = "postgresql"
}

enum Status {
  pending
  active
  cancelled
  // match your domain's OrderStatus/PaymentStatus values exactly
}

enum Currency {
  brl
  usd
  cad
  eur
}

model <Entity> {
  id          String   @id @default(uuid())
  // ...your domain fields
  status      Status
  createdAt   DateTime @default(now())
  updatedAt   DateTime

  @@index([id])
  @@map("<domain>s")  // plural table name
}
```

The enum values in Prisma **must match exactly** the keys in your domain's `as const` status object.

Run after any schema change:
```bash
npx prisma migrate dev --name <migration-name>
npx prisma generate
```
