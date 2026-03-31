# Application Ports Templates

Ports define what the application needs from the outside world. They live in `application/ports/` and are **abstract classes**, not TypeScript interfaces. This is intentional: abstract classes can serve as NestJS injection tokens directly, without needing a separate `Symbol`.

Each examples that is provided here is just to have the context of the implementation, but if will be needed more methods, you should implement it in this file

---

## Inbound port (`application/ports/inbound/http.ts`)

The inbound port describes the "face" of the application to HTTP callers. The controller implements it.

```ts
import { Create<Entity>UseCaseExecuteParams } from "../../use-cases/create-<entity>.js";

export abstract class IHTTPSPort {
  abstract create<Entity>(body: Create<Entity>UseCaseExecuteParams): Promise<unknown>;
  abstract get<Entity>(param: { id: string }): Promise<unknown>;
  abstract delete<Entity>(param: { id: string }): Promise<unknown>;
  abstract cancel<Entity>(param: { id: string }): Promise<unknown>;
}
```

---

## Read repository port (`application/ports/outbound/database/database-read.ts`)

Read ports return **projections** — lean, query-specific shapes — not full domain entities. This enforces CQRS: reads are optimized for the query, not the domain model.

```ts
import { <Entity>StatusType } from "../../../../domain/<entity>.js";

export type PaginationParameters = {
  page: number;
  pageSize: number;
  totalPages: number;
  orderBy?: object;
};

// Abstract pagination result — implementations fill in the concrete type
export abstract class Paginated<Entity>s<T> {
  abstract data: T[];
  abstract page: number;
  abstract pageSize: number;
  abstract total: number;
  abstract hasNext: boolean;
}

// Projection types — only what each query needs, not the whole entity
export type FindByIdProjection = {
  id: string;
  // ...all fields needed for display/return
  status: <Entity>StatusType;
  createdAt: Date | string;
  updatedAt: Date | string;
};

export type FindByStatusProjection = {
  id: string;
  // only the fields needed for this list view
  status: <Entity>StatusType;
};

export abstract class I<Domain>RepositoryReadPort {
  abstract findById(id: string): Promise<FindByIdProjection | null>;
  abstract findByStatus(
    status: <Entity>StatusType,
    pagination: PaginationParameters,
  ): Promise<Paginated<Entity>s<FindByStatusProjection> | null>;
  // add other query methods as needed
}
```

---

## Write repository port (`application/ports/outbound/database/database-write.ts`)

Write ports handle mutations. `findById` is included because some write operations (cancel, update) need to read the current state before mutating — and the write DB is the source of truth.

```ts
import { <Entity>DTO } from "../../../../domain/<entity>.js";
import { FindByIdProjection } from "./database-read.js";

export abstract class I<Domain>RepositoryWritePort {
  abstract findById(id: string): Promise<FindByIdProjection | null>;
  abstract save(entity: <Entity>DTO): Promise<void>;
  abstract updateOne(entity: <Entity>DTO): Promise<void>;
  abstract delete(id: string): Promise<void>;
}
```

---

If the users choses to not use CQRS, then will have only one port to database.

## Cache port (`application/ports/outbound/cache/cache.ts`)

```ts
import { <Entity>DTO } from "../../../../domain/<entity>.js";

export abstract class I<Domain>CachePort {
  abstract get(id: string): Promise<<Entity>DTO | null>;
  abstract set(entity: <Entity>DTO): Promise<void>;
  abstract delete(id: string): Promise<void>;
}
```

For services that need cache by multiple keys (e.g., by idempotency key), add overloaded signatures:

```ts
export abstract class I<Domain>CachePort {
  abstract get(key: string): Promise<<Entity>DTO | null>;
  abstract set(key: string, entity: <Entity>DTO): Promise<void>;
  abstract delete(key: string): Promise<void>;
}
```

---

## Messaging port (`application/ports/outbound/messaging/messaging.ts`)

```ts
export abstract class I<Domain>EventBusPort {
  abstract publish(topic: string, message: object): Promise<void>;
}
```

---

## Telemetry port (`application/ports/outbound/telemetry/telemetry.ts`)

```ts
export abstract class I<Domain>TelemetryPort {
  abstract span<T>(name: string, fn: () => Promise<T>): Promise<T>;
}
```

---

## Naming convention summary

| Port | Naming pattern | Example |
|---|---|---|
| Inbound HTTP | `IHTTPSPort` | `IHTTPSPort` |
| Read DB | `I<Domain>RepositoryReadPort` | `IInventoryRepositoryReadPort` |
| Write DB | `I<Domain>RepositoryWritePort` | `IInventoryRepositoryWritePort` |
| Cache | `I<Domain>CachePort` | `IInventoryCachePort` |
| Messaging | `I<Domain>EventBusPort` | `IInventoryEventBusPort` |
| Telemetry | `I<Domain>TelemetryPort` | `IInventoryTelemetryPort` |

`<Domain>` is the PascalCase service name (e.g., `Orders`, `Payments`, `Inventory`).
