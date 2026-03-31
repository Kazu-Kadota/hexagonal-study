# Outbound Adapter Templates

Outbound adapters implement the application ports. Each adapter is a class that holds a reference to the underlying driver client (Prisma, MongoDB collection, Redis, Kafka producer) and wraps it with the port interface.

Each client/technologies depends on user choices, so basically will exist Prisma if the user opt for use Prisma as ORM to provide Postgres. Next there are examples for these implementations

---

## Postgres write adapter (`adapters/outbound/database/postgres/write.ts`)

Uses Prisma. Both `save` and `updateOne` use `upsert` — idempotent by design.

```ts
import type { <Entity>DTO } from "../../../../domain/<entity>.js";
import { FindByIdProjection } from "../../../../application/ports/outbound/database/database-read.js";
import { I<Domain>RepositoryWritePort } from "../../../../application/ports/outbound/database/database-write.js";
import { PrismaClient } from "../../../../generated/<domain>/client.js";

export class Postgres<Entity>RepositoryWrite implements I<Domain>RepositoryWritePort {
  constructor(private readonly prismaClient: PrismaClient) {}

  async save(entity: <Entity>DTO): Promise<void> {
    await this.prismaClient.<entity>.upsert({
      create: entity,
      update: entity,
      where: { id: entity.id },
    });
  }

  async updateOne(entity: <Entity>DTO): Promise<void> {
    await this.prismaClient.<entity>.upsert({
      create: entity,
      update: entity,
      where: { id: entity.id },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prismaClient.<entity>.delete({ where: { id } });
  }

  async findById(id: string): Promise<FindByIdProjection | null> {
    return await this.prismaClient.<entity>.findUnique({ where: { id } });
  }
}
```

---

## Postgres read adapter (`adapters/outbound/database/postgres/read.ts`)

```ts
import { PrismaClient } from "../../../../generated/<domain>/client.js";
import {
  FindByIdProjection,
  FindByStatusProjection,
  I<Domain>RepositoryReadPort,
  Paginated<Entity>s,
  PaginationParameters,
} from "../../../../application/ports/outbound/database/database-read.js";
import { <Entity>StatusType } from "../../../../domain/<entity>.js";

export class Postgres<Entity>RepositoryRead implements I<Domain>RepositoryReadPort {
  constructor(private readonly prismaClient: PrismaClient) {}

  async findById(id: string): Promise<FindByIdProjection | null> {
    return await this.prismaClient.<entity>.findUnique({ where: { id } });
  }

  async findByStatus(
    status: <Entity>StatusType,
    pagination: PaginationParameters,
  ): Promise<Paginated<Entity>s<FindByStatusProjection> | null> {
    const [data, total] = await Promise.all([
      this.prismaClient.<entity>.findMany({
        where: { status },
        skip: (pagination.page - 1) * pagination.pageSize,
        take: pagination.pageSize,
      }),
      this.prismaClient.<entity>.count({ where: { status } }),
    ]);
    return {
      data,
      page: pagination.page,
      pageSize: pagination.pageSize,
      total,
      hasNext: pagination.page * pagination.pageSize < total,
    };
  }
}
```

---

## MongoDB read adapter (`adapters/outbound/database/mongodb/read.ts`)

The default read adapter (CQRS: Postgres writes, Mongo reads). Maps raw Mongo documents to typed projections explicitly — never return the raw document.

```ts
import type { Collection, WithId } from "mongodb";
import type { <Entity>DTO, <Entity>StatusType } from "../../../../domain/<entity>.js";
import {
  FindByIdProjection,
  FindByStatusProjection,
  I<Domain>RepositoryReadPort,
  Paginated<Entity>s,
  PaginationParameters,
} from "../../../../application/ports/outbound/database/database-read.js";

export class Mongo<Entity>RepositoryRead implements I<Domain>RepositoryReadPort {
  constructor(private readonly collection: Collection<<Entity>DTO>) {}

  private async paginationFind(
    query: object,
    pagination: PaginationParameters,
  ): Promise<[WithId<<Entity>DTO>[], number]> {
    const [docs, total] = await Promise.all([
      this.collection
        .find(query)
        .skip((pagination.page - 1) * pagination.pageSize)
        .limit(pagination.pageSize)
        .toArray(),
      this.collection.countDocuments(query),
    ]);
    return [docs, total];
  }

  async findById(id: string): Promise<FindByIdProjection | null> {
    const doc = await this.collection.findOne({ id });
    if (!doc) return null;
    return {
      id: doc.id,
      // explicitly map each field — don't spread the whole doc
      status: doc.status,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      // ...other projection fields
    };
  }

  async findByStatus(
    status: <Entity>StatusType,
    pagination: PaginationParameters,
  ): Promise<Paginated<Entity>s<FindByStatusProjection> | null> {
    const [docs, total] = await this.paginationFind({ status }, pagination);
    return {
      data: docs.map((doc) => ({ id: doc.id, status: doc.status })),
      page: pagination.page,
      pageSize: pagination.pageSize,
      total,
      hasNext: pagination.page * pagination.pageSize < total,
    };
  }
}
```

---

## MongoDB write adapter (`adapters/outbound/database/mongodb/write.ts`)

```ts
import type { Collection } from "mongodb";
import type { <Entity>DTO } from "../../../../domain/<entity>.js";
import { FindByIdProjection } from "../../../../application/ports/outbound/database/database-read.js";
import { I<Domain>RepositoryWritePort } from "../../../../application/ports/outbound/database/database-write.js";

export class Mongo<Entity>RepositoryWrite implements I<Domain>RepositoryWritePort {
  constructor(private readonly collection: Collection<<Entity>DTO>) {}

  async save(entity: <Entity>DTO): Promise<void> {
    await this.collection.updateOne({ id: entity.id }, { $set: entity }, { upsert: true });
  }

  async updateOne(entity: <Entity>DTO): Promise<void> {
    await this.collection.updateOne({ id: entity.id }, { $set: entity }, { upsert: true });
  }

  async delete(id: string): Promise<void> {
    await this.collection.deleteOne({ id });
  }

  async findById(id: string): Promise<FindByIdProjection | null> {
    const doc = await this.collection.findOne({ id });
    if (!doc) return null;
    return { id: doc.id, status: doc.status, createdAt: doc.createdAt, updatedAt: doc.updatedAt };
  }
}
```

---

## Redis cache adapter (`adapters/outbound/cache/redis/<entity>-cache.ts`)

Key pattern: `<entity>:<id>`. Always include TTL (60 seconds default). JSON serialize/deserialize.

```ts
import { Redis } from "ioredis";
import { I<Domain>CachePort } from "../../../../application/ports/outbound/cache/cache.js";
import { <Entity>DTO } from "../../../../domain/<entity>.js";

export class Redis<Entity>Cache implements I<Domain>CachePort {
  constructor(private readonly redis: Redis) {}

  async get(id: string): Promise<<Entity>DTO | null> {
    const raw = await this.redis.get(`<entity>:${id}`);
    return raw ? (JSON.parse(raw) as <Entity>DTO) : null;
  }

  async set(entity: <Entity>DTO): Promise<void> {
    await this.redis.set(`<entity>:${entity.id}`, JSON.stringify(entity), "EX", 60);
  }

  async delete(id: string): Promise<void> {
    await this.redis.del(`<entity>:${id}`);
  }
}
```

For services needing arbitrary-key caching (e.g., idempotency keys), adjust the signature:
```ts
async get(key: string): Promise<<Entity>DTO | null>
async set(key: string, entity: <Entity>DTO): Promise<void>
```

---

## Kafka event bus adapter (`adapters/outbound/messaging/kafka/event-bus.ts`)

```ts
import type { Producer } from "kafkajs";
import { I<Domain>EventBusPort } from "../../../../application/ports/outbound/messaging/messaging.js";

export class KafkaEventBus implements I<Domain>EventBusPort {
  constructor(private readonly producer: Producer) {}

  async publish(topic: string, message: object): Promise<void> {
    await this.producer.send({
      topic,
      messages: [{ value: JSON.stringify(message) }],
    });
  }
}
```

---

## OpenTelemetry telemetry adapter (`adapters/outbound/telemetry/otel/otel-telemetry.ts`)

```ts
import { trace } from "@opentelemetry/api";
import { I<Domain>TelemetryPort } from "../../../../application/ports/outbound/telemetry/telemetry.js";

export class OTelTelemetry implements I<Domain>TelemetryPort {
  async span<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const tracer = trace.getTracer("<domain>-service");
    return tracer.startActiveSpan(name, async (span) => {
      try {
        const result = await fn();
        span.end();
        return result;
      } catch (error) {
        span.recordException(error as Error);
        span.end();
        throw error;
      }
    });
  }
}
```

---

## External gateway adapter (e.g., Stripe)

For services that call external payment providers or third-party APIs, add a gateway port + adapter:

```ts
// application/ports/outbound/payment-gateway/payment-gateway.ts
export type CreatePaymentIntentParams = {
  amount: number;
  currency: string;
  idempotencyKey: string;
  metadata: Record<string, string>;
};

export type PaymentIntent = {
  id: string;
  status: string;
};

export abstract class I<Domain>GatewayPort {
  abstract createPaymentIntent(params: CreatePaymentIntentParams): Promise<PaymentIntent>;
}

// adapters/outbound/payment-gateway/stripe/stripe-gateway.ts
import Stripe from "stripe";
import { I<Domain>GatewayPort, CreatePaymentIntentParams, PaymentIntent } from "../../../../application/ports/outbound/payment-gateway/payment-gateway.js";

export class StripeGateway implements I<Domain>GatewayPort {
  constructor(private readonly stripe: Stripe) {}

  async createPaymentIntent(params: CreatePaymentIntentParams): Promise<PaymentIntent> {
    const intent = await this.stripe.paymentIntents.create(
      {
        amount: params.amount,
        currency: params.currency,
        metadata: params.metadata,
      },
      { idempotencyKey: params.idempotencyKey },
    );
    return { id: intent.id, status: intent.status };
  }
}
```
