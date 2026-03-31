# Use Case Templates

Use cases live in `application/use-cases/`. One file per use case. Each use case is a class with a single `execute()` method. You can also produce do it as function, but always ask to the user to maintain the pattern.

Dependencies are always constructor-injected. The use case never instantiates a concrete adapter.

Every `execute()` body is wrapped in `this.telemetry.span("<domain>.<action>", async () => { ... })`.

---

## Create use case

```ts
// src/application/use-cases/create-<entity>.ts
import { <Entity>, <Entity>DTO, CurrencyType } from "../../domain/<entity>.js";
import { I<Domain>CachePort } from "../ports/outbound/cache/cache.js";
import { I<Domain>RepositoryWritePort } from "../ports/outbound/database/database-write.js";
import { I<Domain>EventBusPort } from "../ports/outbound/messaging/messaging.js";
import { I<Domain>TelemetryPort } from "../ports/outbound/telemetry/telemetry.js";

export type Create<Entity>UseCaseExecuteParams = {
  // ...whatever the caller provides (no id, no status)
  customerId: string;
  amount: number;
  currency: CurrencyType;
};

export class Create<Entity>UseCase {
  constructor(
    private readonly writeRepository: I<Domain>RepositoryWritePort,
    private readonly cache: I<Domain>CachePort,
    private readonly eventBus: I<Domain>EventBusPort,
    private readonly telemetry: I<Domain>TelemetryPort,
  ) {}

  async execute(input: Create<Entity>UseCaseExecuteParams): Promise<<Entity>DTO> {
    return this.telemetry.span("<domain>.create", async () => {
      const entity = <Entity>.create({
        customerId: input.customerId,
        amount: input.amount,
        currency: input.currency,
      });
      const dto = entity.toDTO();

      await this.writeRepository.save(dto);
      await this.cache.set(dto);
      await this.eventBus.publish("<entity>.created", {
        type: "<entity>.created",
        payload: {
          <entity>Id: dto.id,
          customerId: dto.customerId,
          amount: dto.amount,
          currency: dto.currency,
          idempotencyKey: crypto.randomUUID(), // include if the downstream needs deduplication
        },
      });

      return dto;
    });
  }
}
```

---

## Get (read) use case

Cache-first: check cache → if miss, read from DB → populate cache → return.

```ts
// src/application/use-cases/get-<entity>.ts
import { I<Domain>CachePort } from "../ports/outbound/cache/cache.js";
import { I<Domain>RepositoryReadPort } from "../ports/outbound/database/database-read.js";
import { I<Domain>TelemetryPort } from "../ports/outbound/telemetry/telemetry.js";

export class Get<Entity>UseCase {
  constructor(
    private readonly readRepository: I<Domain>RepositoryReadPort,
    private readonly cache: I<Domain>CachePort,
    private readonly telemetry: I<Domain>TelemetryPort,
  ) {}

  async execute(id: string) {
    return this.telemetry.span("<domain>.get", async () => {
      const cached = await this.cache.get(id);
      if (cached) return cached;

      const entity = await this.readRepository.findById(id);
      if (!entity) throw new Error("<Entity> not found");

      await this.cache.set(entity);
      return entity;
    });
  }
}
```

---

## Cancel (state transition) use case

Cache-first read → reconstitute entity → call transition method → persist → update cache → publish event.

```ts
// src/application/use-cases/cancel-<entity>.ts
import { <Entity> } from "../../domain/<entity>.js";
import { I<Domain>CachePort } from "../ports/outbound/cache/cache.js";
import { I<Domain>RepositoryReadPort } from "../ports/outbound/database/database-read.js";
import { I<Domain>RepositoryWritePort } from "../ports/outbound/database/database-write.js";
import { I<Domain>EventBusPort } from "../ports/outbound/messaging/messaging.js";
import { I<Domain>TelemetryPort } from "../ports/outbound/telemetry/telemetry.js";

export class Cancel<Entity>UseCase {
  constructor(
    private readonly readRepository: I<Domain>RepositoryReadPort,
    private readonly writeRepository: I<Domain>RepositoryWritePort,
    private readonly cache: I<Domain>CachePort,
    private readonly eventBus: I<Domain>EventBusPort,
    private readonly telemetry: I<Domain>TelemetryPort,
  ) {}

  private async cancel<Entity>(entity: <Entity>): Promise<void> {
    entity.cancel();
    const dto = entity.toDTO();

    await this.writeRepository.updateOne(dto);
    await this.cache.set(dto);
    await this.eventBus.publish("<entity>.cancelled", {
      type: "<entity>.cancelled",
      payload: {
        <entity>Id: dto.id,
        // include relevant fields for downstream consumers
      },
    });
  }

  async execute(id: string): Promise<void> {
    return this.telemetry.span("<domain>.cancel", async () => {
      // Try cache first (avoids a DB round-trip in the hot path)
      const cached = await this.cache.get(id);
      if (cached) {
        const entity = <Entity>.reconstitute(cached);
        await this.cancel<Entity>(entity);
        return;
      }

      // Cache miss — fall back to the read DB
      const projection = await this.readRepository.findById(id);
      if (!projection) throw new Error("<Entity> not found");

      const entity = <Entity>.reconstitute(projection);
      await this.cancel<Entity>(entity);
    });
  }
}
```

---

## Delete use case

```ts
// src/application/use-cases/delete-<entity>.ts
import { I<Domain>CachePort } from "../ports/outbound/cache/cache.js";
import { I<Domain>RepositoryWritePort } from "../ports/outbound/database/database-write.js";
import { I<Domain>EventBusPort } from "../ports/outbound/messaging/messaging.js";
import { I<Domain>TelemetryPort } from "../ports/outbound/telemetry/telemetry.js";

export class Delete<Entity>UseCase {
  constructor(
    private readonly writeRepository: I<Domain>RepositoryWritePort,
    private readonly cache: I<Domain>CachePort,
    private readonly eventBus: I<Domain>EventBusPort,
    private readonly telemetry: I<Domain>TelemetryPort,
  ) {}

  async execute(id: string): Promise<void> {
    return this.telemetry.span("<domain>.delete", async () => {
      await this.writeRepository.delete(id);
      await this.cache.delete(id);
      await this.eventBus.publish("<entity>.deleted", {
        type: "<entity>.deleted",
        payload: { <entity>Id: id },
      });
    });
  }
}
```

---

## Idempotency pattern (for payment-like use cases)

When a use case must be safe to replay (e.g., charging a customer), check idempotency before acting:

```ts
async execute(input: CreatePaymentUseCaseParams): Promise<PaymentDTO> {
  return this.telemetry.span("payments.create", async () => {
    const cacheKey = `paymentsIdempotencyKey:${input.idempotencyKey}`;

    // 1. Check cache first
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    // 2. Check DB for existing record with this idempotency key
    const existing = await this.readRepository.findByIdempotencyKey(input.idempotencyKey);
    if (existing) {
      await this.cache.set(cacheKey, existing);
      return existing;
    }

    // 3. Not found — proceed with the actual operation
    const dto = /* ... create + persist + publish */;

    await this.cache.set(cacheKey, dto);
    await this.cache.set(`payments:${dto.id}`, dto);
    return dto;
  });
}
```
