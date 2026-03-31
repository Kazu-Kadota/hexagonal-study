---
name: hexagonal-microservice-scaffold
description: >
  Scaffolds a complete TypeScript monorepo microservice using Hexagonal Architecture (Ports & Adapters),
  Clean Architecture, Domain-Driven Design, and Event-Driven Architecture — exactly matching the
  production-patterned structure of the reference implementation. Use this skill whenever the user wants
  to create a new microservice, add a new domain service to a monorepo, scaffold a new repository with
  this architecture, replicate the hexagonal pattern in a new project, generate boilerplate for a DDD
  microservice, or asks "how do I structure a new service". This skill should trigger even if the user
  just says "add a products service" or "create a new microservice for X" or "set up a new repo like this
  one" — because the answer involves generating a complete, consistent file structure.
---

# Hexagonal Microservice Scaffold

This skill generates a complete, production-patterned TypeScript microservice (or full monorepo) using
**Hexagonal Architecture** (Ports & Adapters), **Clean Architecture** layering, **Domain-Driven Design**
entities, and **Event-Driven** communication, not depending in which technology are used (SNS, Kafka, etc).

The reference implementation lives at `https://github.com/Kazu-Kadota/hexagonal-study/services/orders` and `https://github.com/Kazu-Kadota/hexagonal-study/services/payments`.
If those paths are accessible, always read the actual source as your ground truth. This skill documents
the patterns so you can replicate them anywhere.

This skill will be used for another people and companies, so this is just a guideline, not a instruction of how you must implement.
You need to understand how the user want to implement, so ask clarify questions (as step 0).

---

## Step 0 — Gather context before writing any code

Ask the user (or infer from context) the following. Never guess the domain without checking.

1. **Domain name** — the bounded context (e.g. `orders`,  `health`, `science`)
2. **Entity name** — the aggregate root (e.g. `Order`, `Health`, `Articles`)
3. **Entity fields** — what data does it hold?
4. **States/transitions** — what status values exist? What business operations change state?
5. **Use cases** — what actions does the service expose? (create, get, cancel, delete, etc.)
6. **Inbound protocol** — HTTP only? Express, NestJS, or both?
7. **Write database** — Postgres (default) or MongoDB?
8. **Read database** — same as write (no CQRS) or a separate read store? If separate, ask which sync strategy: inline, outbox, event-driven, or CDC. See `references/cqrs-sync.md` for the tradeoff table.
9. **External dependencies** — does it call another service, like payment gateway?
10. **Monorepo or standalone?** — adding to an existing monorepo root, or creating from scratch?

---

## Step 1 — Monorepo root (only if creating from scratch)

See `references/monorepo.md` for the root `package.json`, `tsconfig.json`, and `docker-compose.yml` templates.

The root `package.json` uses npm workspaces: `"workspaces": ["services/*"]`.
Each service is independently deployable with its own `package.json` named `@<prefix>/<service-name>`.

---

## Step 2 — Service skeleton

> **If the request covers multiple services**, scaffold them **one at a time**. Complete every layer of the first service fully before moving to the second. After each service is done, confirm with the user before proceeding. Partial scaffolding of many services at once is far less useful than one complete, working service.

Create this directory tree adapted to the technologies the user chose (e.g. DynamoDB instead of Postgres → `adapters/outbound/database/dynamodb/`; SQS instead of Kafka → `adapters/outbound/messaging/sqs/`; gRPC instead of Express → `adapters/inbound/grpc/`). Only include directories that correspond to the chosen stack — do not generate Prisma files if the user is not using Postgres/Prisma, do not add a Redis folder if using an in-memory cache, etc.

Substitute `<entity>` with the lowercase entity name, `<Entity>` with PascalCase:

```
services/<domain>/
├── package.json
├── tsconfig.json
├── prisma.config.ts
├── prisma/
│   └── schema.prisma
├── .env.example
└── src/
    ├── main.ts
    ├── domain/
    │   └── <entity>.ts
    ├── application/
    │   ├── ports/
    │   │   ├── inbound/
    │   │   │   └── http.ts
    │   │   └── outbound/
    │   │       ├── database/
    │   │       │   ├── database-read.ts
    │   │       │   └── database-write.ts
    │   │       ├── cache/
    │   │       │   └── cache.ts
    │   │       ├── messaging/
    │   │       │   └── messaging.ts
    │   │       └── telemetry/
    │   │           └── telemetry.ts
    │   └── use-cases/
    │       ├── create-<entity>.ts
    │       ├── get-<entity>.ts
    │       ├── cancel-<entity>.ts     ← only if entity has a cancel operation
    │       └── delete-<entity>.ts
    ├── adapters/
    │   ├── inbound/
    │   │   └── http/
    │   │       ├── express/
    │   │       │   ├── bootstrap.ts
    │   │       │   ├── <entity>-controller.ts
    │   │       │   └── dtos/
    │   │       │       ├── create-<entity>.ts
    │   │       │       └── get-<entity>.ts
    │   │       └── nest/
    │   │           ├── bootstrap.ts
    │   │           ├── <entity>.controller.ts
    │   │           ├── <entity>.service.ts
    │   │           ├── <entity>.module.ts
    │   │           ├── token.ts
    │   │           ├── infra/
    │   │           │   └── client-shutdown.service.ts
    │   │           └── dtos/
    │   │               └── <entity>.ts
    │   └── outbound/
    │       ├── database/
    │       │   ├── postgres/
    │       │   │   ├── read.ts
    │       │   │   └── write.ts
    │       │   └── mongodb/
    │       │       ├── read.ts
    │       │       └── write.ts
    │       ├── cache/
    │       │   └── redis/
    │       │       └── <entity>-cache.ts
    │       ├── messaging/
    │       │   └── kafka/
    │       │       └── event-bus.ts
    │       └── telemetry/
    │           └── otel/
    │               └── otel-telemetry.ts
    └── infrastructure/
        ├── config.ts
        ├── database/
        │   ├── ports.ts
        │   ├── postgres/
        │   │   └── connection.ts
        │   └── mongodb/
        │       └── connection.ts
        ├── cache/
        │   ├── ports.ts
        │   └── redis/
        │       └── connection.ts
        ├── messaging/
        │   ├── port.ts
        │   └── kafka/
        │       └── connection.ts
        └── telemetry/
            ├── ports.ts
            └── otel/
                └── connection.ts
```

### Multiple aggregates in one service

When a service contains more than one aggregate (e.g., `Article` + `Tip` in an `articles` service), add an aggregate-level subfolder within each layer. The layer-first structure is preserved — the aggregate name is just one level deeper:

```
src/
├── domain/
│   ├── article/
│   │   └── article.ts
│   └── tip/
│       └── tip.ts
├── application/
│   ├── ports/
│   │   └── outbound/
│   │       ├── database/
│   │       │   ├── article/
│   │       │   │   ├── database-read.ts
│   │       │   │   └── database-write.ts
│   │       │   └── tip/
│   │       │       ├── database-read.ts
│   │       │       └── database-write.ts
│   │       └── messaging/
│   │           └── article/          ← only if this aggregate publishes events
│   │               └── messaging.ts
│   └── use-cases/
│       ├── article/
│       │   └── create-article.ts
│       └── tip/
│           └── create-tip.ts
├── adapters/
│   ├── inbound/
│   │   └── http/
│   │       └── express/
│   │           ├── bootstrap.ts      ← single bootstrap wires all aggregate controllers
│   │           ├── article/
│   │           │   └── article-controller.ts
│   │           └── tip/
│   │               └── tip-controller.ts
│   └── outbound/
│       ├── database/
│       │   └── postgres/
│       │       ├── article/
│       │       └── tip/
│       └── messaging/
│           └── kafka/
│               └── article-event-bus.ts   ← tip has no event bus adapter
└── infrastructure/
    └── ...                           ← connections are shared; not duplicated per aggregate
```

Rules:
- **Only create ports and adapters for what an aggregate actually uses.** If `Tip` doesn't publish events, there is no messaging port or adapter for it.
- **Infrastructure connections are shared.** One Postgres connection, one Kafka producer — wired once in `bootstrap.ts` and passed to whichever adapters need them.
- **Telemetry is shared across all aggregates** — no aggregate subfolder needed under `ports/outbound/telemetry/`.
- **One bootstrap, multiple controllers.** `bootstrap.ts` mounts each aggregate's controller at its own path: `app.use('/articles', articleController.buildRouter())`, `app.use('/tips', tipController.buildRouter())`.
- **Use cases are single-aggregate.** No use case coordinates across aggregates.

---

## Step 3 — Layer-by-layer implementation order

Always implement in this order (each layer depends on the ones before it):

### 3a. Domain layer (`src/domain/<entity>.ts`)

The domain is a plain TypeScript class with **zero framework imports**. See `references/domain.md`.

Key rules:
- Private constructor — force use of `create()` and `reconstitute()`
- `static create(dto)` — validates invariants, throws descriptive errors, generates UUID via `crypto.randomUUID()`
- `static reconstitute(raw)` — rebuilds from persistence without re-validating (trusts stored data)
- `toDTO()` — returns a plain object snapshot; use this to cross layer boundaries
- State transitions are methods (e.g., `cancel()`) that mutate private fields and update `updatedAt`
- Status enums use `as const` objects, never TypeScript `enum`

### 3b. Application ports (`src/application/ports/`)

Ports are **abstract classes** (not TypeScript interfaces). See `references/ports.md`.

Name them: `I<DomainName><Category>Port` — e.g., `IInventoryRepositoryReadPort`.

- **Inbound port** (`ports/inbound/http.ts`): abstract class `IHTTPSPort` with one abstract method per use case, matching the use case input/output types.
- **Read port**: projections (lean types, not full entities), plus pagination helpers.
- **Write port**: `save`, `updateOne`, `delete`, `findById` (for optimistic lock checks before write).
- **Cache port**: `get(id)`, `set(entity)`, `delete(id)`.
- **Messaging port**: `publish(topic, message)`.
- **Telemetry port**: `span<T>(name, fn)`.

The cache port's `set()` takes the full DTO (not `id + data`) to keep it simple.

### 3c. Use cases (`src/application/use-cases/`)

One file, one class, one public `execute()` method. See `references/use-cases.md`.

Constructor-inject all dependencies (repositories, cache, eventBus, telemetry). No `new ConcreteAdapter()` inside use cases.

Standard execute patterns:
- **Create**: validate via `Entity.create()` → `toDTO()` → write to DB → set cache → publish event → return DTO
- **Get**: cache lookup → DB read fallback → set cache → return
- **Cancel/Update**: cache or DB read → `Entity.reconstitute()` → call transition method → `toDTO()` → write → update cache → publish event
- **Delete**: write repo `delete()` → cache `delete()` → publish event

Wrap the entire execute body in `this.telemetry.span("<domain>.<action>", async () => { ... })`.

Span naming convention: `<domain>.<action>` (e.g. `inventory.reserve`, `notifications.send`).

### 3d. Outbound adapters (`src/adapters/outbound/`)

Each adapter is a class that **implements** one port. See `references/adapters-outbound.md`.

There are a example of each implementation:

- **PostgresWrite** (Prisma): `upsert` for both `save` and `updateOne`, `delete` by id, `findUnique` for `findById`
- **MongoRead**: `findOne` / `find` with pagination for read projections — maps raw MongoDB documents to typed projection objects
- **MongoWrite**: same as Postgres write but using MongoDB collection API
- **RedisCache**: key pattern `<entity>:<id>`, always set TTL (default 60 seconds), parse/stringify JSON
- **KafkaEventBus**: `producer.send({ topic, messages: [{ value: JSON.stringify(message) }] })`
- **OTelTelemetry**: `tracer.startActiveSpan(name, async (span) => { try { result = await fn(); span.end(); return result; } catch(e) { span.recordException(e); span.end(); throw e; } })`

### 3e. Infrastructure connections (`src/infrastructure/`)

Connection classes implement abstract port interfaces (`RepositoryConnectionPort`, `MessagingConnectionPort`, `TelemetryConnectionPort`). See `references/infrastructure.md`.

Pattern: lazy singleton — check `if (this.client) return` at the top of `connect()`. Expose `getClient()` that throws if not connected. Implement `isHealthy()` for each connection.

Config (`config.ts`): Zod schema that reads from `process.env`, provides defaults, and exports a single typed `config` object. No `process.env` access anywhere else in the codebase.

### 3f. Inbound adapters (`src/adapters/inbound/`)

Inbound adapters come in two flavours: **request-driven** (HTTP, gRPC) and **event-driven** (Kafka consumer, SQS poller). Both drive use cases in exactly the same way — the use case does not know which type called it.

**HTTP / Express** (`adapters/inbound/http/express/`):
- `<entity>-controller.ts`: implements `IHTTPSPort`, holds use case instances, has `buildRouter()` returning an Express `Router`
- `bootstrap.ts`: the **composition root** — connects all infrastructure, instantiates adapters, wires use cases, wires controller, starts express server, registers graceful shutdown

**HTTP / NestJS** (`adapters/inbound/http/nest/`):
- `token.ts`: `Symbol` constants for every injectable (one per connection, adapter, and use case)
- `<entity>.module.ts`: `@Module` with `useFactory` providers for every token; the factories mirror the Express bootstrap wiring
- `<entity>.service.ts`: `@Injectable()` that injects use cases via `@Inject(UseCaseClass)` and delegates to them
- `<entity>.controller.ts`: `@Controller()` with route handlers that call the service
- `infra/client-shutdown.service.ts`: NestJS lifecycle hook for graceful shutdown of connections

**Messaging consumer** (`adapters/inbound/messaging/kafka/` or `.../sqs/`):
- `<entity>-consumer.ts`: subscribes to one or more topics; on each message, parses the payload and delegates to the matching use case. **Only parses and delegates — no business logic here.** Unknown topics and malformed messages are logged and skipped (never thrown).
- `bootstrap.ts`: second composition root — wires its own connections and use cases, starts the consumer, registers graceful shutdown. Runs in parallel with the HTTP bootstrap in `main.ts`.
- No new inbound port abstract class is needed: the use case is already the application boundary. Only add a consumer port if you have a concrete reason to swap the consumer implementation.

See `references/adapters-inbound.md` for full templates of all three variants.

### 3g. Entry point (`src/main.ts`)

Bootstrap the application depending of the configuration and preferences of the user. In the next example, there is Telemetry configuration from start and HTTP Express and Nest implementations, but it could have gRPC or WebSocket implementations also, for example. 

```ts
import { config } from "./infrastructure/config.js";
import { bootstrapExpress } from "./adapters/inbound/http/express/bootstrap.js";
// import { bootstrapNest } from "./adapters/inbound/http/nest/bootstrap.js";
import { TelemetryConnection } from "./infrastructure/telemetry/otel/connection.ts";

async function bootstrap() {
  const telemetry = new TelemetryConnection(`${config.app.name}-service`, config.telemetry.otel.endpoint);
  telemetry.start();

  await bootstrapExpress();
  // await bootstrapNest();
}

bootstrap().catch((error) => { console.error(error); process.exit(1); });
```

---

## Step 4 — Event conventions

Next, there is a example for Kafka Event, but it could be others services like SNS.

- Topic names: `<entity>.<past-tense-verb>` — e.g. `product.created`, `inventory.reserved`
- Event payload shape (always include `type` and `payload`):
  ```ts
  { type: "product.created", payload: { productId, name, price, idempotencyKey } }
  ```
- The event bus adapter publishes; Kafka consumer adapters (inbound) subscribe in their own bootstrap
- Place shared event type definitions in `shared/events/` at the monorepo root

---

## Step 5 — Layering rules (enforce strictly)

| Layer | Can import | Cannot import |
|---|---|---|
| `domain/` | nothing | everything |
| `application/` | `domain/`, own `ports/` | adapters, infrastructure, Express, NestJS, Prisma |
| `adapters/` | `application/`, `domain/` | other adapters, infrastructure (pass via constructor) |
| `infrastructure/` | own connections | domain logic, application logic |
| `bootstrap.ts` | all of the above | — it is the composition root |

If you see `import express` inside `application/`, that's a violation. Fix it before continuing.

---

## Step 6 — Tests (if requested)

If the user asks for tests, read `references/testing.md` for full patterns. The short version:

- **`src/domain/_test/<entity>.test.ts`** — pure TS, no mocks, covers every validation branch in `create()` and every guard in transition methods
- **`src/application/use-cases/_test/doubles.ts`** — shared test doubles that extend the abstract port classes (not `vi.fn()`)
- **`src/application/use-cases/_test/<use-case>.test.ts`** — unit tests wired with the doubles; one file per use case
- **`src/_test/e2e/setup.ts`** — builds the Express app with in-memory adapters; no test containers needed
- **`src/_test/e2e/<action>.e2e.test.ts`** — supertest against the real controller/use case/domain stack

Use **Vitest**. Add `"test": "vitest run"` and `"test:e2e": "vitest run _test/e2e"` to `package.json`.

---

## Step 7 — Quality checklist before declaring done

- [ ] `domain/<entity>.ts` has no external imports
- [ ] All ports are abstract classes, not interfaces
- [ ] Every use case wraps its execute body in `telemetry.span()`
- [ ] Redis cache always includes TTL in `set()`
- [ ] `process.env` only accessed inside `infrastructure/config.ts`
- [ ] If Express as choice of the user: Express bootstrap has graceful shutdown with `Promise.allSettled` across all connections
- [ ] If NestJS as choice of the user: NestJS `token.ts` has a Symbol for every injectable
- [ ] If Prisma as choice of the user: Prisma schema enums match domain entity enum values exactly
- [ ] Span names follow `<domain>.<action>` convention
- [ ] If Kafka as choice of the user: Kafka topics follow `<entity>.<past-tense-verb>` convention
- [ ] If tests requested: domain tests cover all validation branches; use case test doubles extend abstract port classes; E2E setup uses in-memory adapters
- [ ] If error handling requested: typed errors in `domain/errors.ts` (DomainError base + subtypes); inbound adapters translate via `instanceof`; `DomainError` logged as warn, infra errors as error. See `references/errors.md` for HTTP/gRPC/WS/GraphQL mapping conventions.
- [ ] All local imports use `.js` extension (e.g. `from './domain/order.js'`) — required by NodeNext module resolution

---

## Reference files

- `references/monorepo.md` — root package.json, tsconfig, docker-compose templates
- `references/domain.md` — domain entity template with full annotated example
- `references/ports.md` — all port abstract classes with annotations
- `references/use-cases.md` — use case templates for create/get/cancel/delete patterns
- `references/adapters-outbound.md` — outbound adapter implementations (Postgres, Mongo, Redis, Kafka, OTel)
- `references/adapters-inbound.md` — Express controller+bootstrap and NestJS module+service+controller+tokens
- `references/infrastructure.md` — connection classes, config.ts Zod schema, Prisma schema template
- `references/testing.md` — test structure, domain/use-case/E2E patterns, Vitest setup
- `references/errors.md` — DomainError hierarchy, HTTP/gRPC/WebSocket/GraphQL translation patterns
- `references/cqrs-sync.md` — read model sync strategies (inline, outbox, event-driven, CDC) with tradeoff table; read when user asks for CQRS
