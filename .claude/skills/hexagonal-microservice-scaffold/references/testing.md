# Testing Guide

Hexagonal architecture has a natural seam between layers that makes testing straightforward:
- **Domain tests** need no mocks at all — the domain is pure TypeScript
- **Use case tests** need only lightweight port stubs — extend abstract classes, not `jest.fn()`
- **E2E tests** wire real layers (controller → use case → domain) with in-memory adapters — no test containers needed for fast feedback

Use **Vitest** across all layers. It's fast, has ESM support out of the box, and the API is compatible with Jest.

---

## Directory structure

Unit tests live in a `_test/` directory co-located with the code they test:

```
src/
├── domain/
│   ├── <entity>.ts
│   └── _test/
│       └── <entity>.test.ts
├── application/
│   └── use-cases/
│       ├── create-<entity>.ts
│       └── _test/
│           ├── create-<entity>.test.ts
│           └── get-<entity>.test.ts
└── adapters/
    └── outbound/
        └── database/
            └── postgres/
                └── _test/
                    └── write.test.ts   ← integration test, requires real DB
```

E2E tests live in a top-level `_test/` directory at the src root:

```
services/<domain>/
├── src/
    └── _test/
        └── e2e/
            ├── setup.ts                   ← builds Express app with in-memory adapters
            ├── create-<entity>.e2e.test.ts
            └── get-<entity>.e2e.test.ts
```

---

## 1. Domain unit tests

Domain tests are the simplest tests in the codebase. The domain entity is a pure TypeScript class with no dependencies — just instantiate it and assert.

Cover every validation branch in `create()`, every guard in transition methods, and the `reconstitute()` → `toDTO()` round-trip.

```ts
// src/domain/_test/order.test.ts
import { describe, it, expect } from 'vitest'
import { Order, OrderStatus } from '../order.js'

const validCreateInput = {
  customerId: 'cust-1',
  items: [{ productId: 'prod-1', quantity: 2, unitPrice: 50 }],
}

describe('Order.create()', () => {
  it('creates an order with pending status and a generated id', () => {
    const dto = Order.create(validCreateInput).toDTO()
    expect(dto.status).toBe(OrderStatus.pending)
    expect(dto.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(dto.customerId).toBe('cust-1')
  })

  it('throws when customerId is empty', () => {
    expect(() => Order.create({ ...validCreateInput, customerId: '' }))
      .toThrow('customerId is required')
  })

  it('throws when items list is empty', () => {
    expect(() => Order.create({ ...validCreateInput, items: [] }))
      .toThrow()
  })
})

describe('Order.cancel()', () => {
  it('transitions from pending to cancelled', () => {
    const order = Order.reconstitute({ id: 'ord-1', ...validCreateInput, status: 'pending', createdAt: new Date(), updatedAt: new Date() })
    order.cancel()
    expect(order.toDTO().status).toBe(OrderStatus.cancelled)
  })

  it('throws when order is already cancelled', () => {
    const order = Order.reconstitute({ id: 'ord-1', ...validCreateInput, status: 'cancelled', createdAt: new Date(), updatedAt: new Date() })
    expect(() => order.cancel()).toThrow()
  })
})

describe('Order.reconstitute() → toDTO()', () => {
  it('round-trips without mutation', () => {
    const raw = { id: 'ord-1', customerId: 'cust-1', items: [], status: 'pending', createdAt: new Date(), updatedAt: new Date() }
    const dto = Order.reconstitute(raw).toDTO()
    expect(dto.id).toBe(raw.id)
    expect(dto.status).toBe(raw.status)
  })
})
```

**What to cover:**
- Every validation rule in `create()` — one test per invariant
- Every guard in each transition method (e.g., can't cancel a delivered order)
- The `reconstitute()` → `toDTO()` round-trip preserves all fields
- State after each transition (check `updatedAt` changed if relevant)

---

## 2. Use case unit tests

Use cases depend on ports. Instead of mocking with `vi.fn()`, extend the abstract port classes — this forces TypeScript to verify your test double satisfies the full contract.

Keep test doubles minimal: only implement what the test exercises. Use a shared `doubles.ts` file if multiple use case test files need the same stubs.

```ts
// src/application/use-cases/_test/doubles.ts
import { IOrderRepositoryWritePort } from '../../ports/outbound/database/database-write.js'
import { IOrderRepositoryReadPort } from '../../ports/outbound/database/database-read.js'
import { IOrderCachePort } from '../../ports/outbound/cache/cache.js'
import { IOrderMessagingPort } from '../../ports/outbound/messaging/messaging.js'
import { ITelemetryPort } from '../../ports/outbound/telemetry/telemetry.js'
import type { OrderDTO } from '../../../domain/order.js'

export class FakeWriteRepo extends IOrderRepositoryWritePort {
  store: OrderDTO[] = []
  async save(dto: OrderDTO) { this.store.push(dto) }
  async updateOne(dto: OrderDTO) {
    const i = this.store.findIndex(o => o.id === dto.id)
    if (i >= 0) this.store[i] = dto
  }
  async delete(id: string) { this.store = this.store.filter(o => o.id !== id) }
  async findById(id: string) { return this.store.find(o => o.id === id) ?? null }
}

export class FakeReadRepo extends IOrderRepositoryReadPort {
  store: OrderDTO[] = []
  async findById(id: string) { return this.store.find(o => o.id === id) ?? null }
}

export class FakeCache extends IOrderCachePort {
  store = new Map<string, OrderDTO>()
  async get(id: string) { return this.store.get(id) ?? null }
  async set(dto: OrderDTO) { this.store.set(dto.id, dto) }
  async delete(id: string) { this.store.delete(id) }
}

export class FakeEventBus extends IOrderMessagingPort {
  events: { topic: string; message: unknown }[] = []
  async publish(topic: string, message: unknown) { this.events.push({ topic, message }) }
}

// Telemetry that passes through — span() just calls the function
export class PassthroughTelemetry extends ITelemetryPort {
  async span<T>(_name: string, fn: () => Promise<T>): Promise<T> { return fn() }
}
```

```ts
// src/application/use-cases/_test/create-order.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { CreateOrderUseCase } from '../create-order.js'
import { FakeWriteRepo, FakeCache, FakeEventBus, PassthroughTelemetry } from './doubles.js'

describe('CreateOrderUseCase', () => {
  let writeRepo: FakeWriteRepo
  let cache: FakeCache
  let eventBus: FakeEventBus
  let useCase: CreateOrderUseCase

  beforeEach(() => {
    writeRepo = new FakeWriteRepo()
    cache = new FakeCache()
    eventBus = new FakeEventBus()
    useCase = new CreateOrderUseCase(writeRepo, cache, eventBus, new PassthroughTelemetry())
  })

  it('persists the order and populates cache', async () => {
    const result = await useCase.execute({ customerId: 'cust-1', items: [{ productId: 'p1', quantity: 1, unitPrice: 10 }] })

    expect(writeRepo.store).toHaveLength(1)
    expect(writeRepo.store[0].customerId).toBe('cust-1')
    expect(cache.store.get(result.id)).toMatchObject({ id: result.id })
  })

  it('publishes order.created with the correct payload', async () => {
    const result = await useCase.execute({ customerId: 'cust-1', items: [{ productId: 'p1', quantity: 1, unitPrice: 10 }] })

    expect(eventBus.events).toHaveLength(1)
    expect(eventBus.events[0].topic).toBe('order.created')
    expect(eventBus.events[0].message).toMatchObject({ type: 'order.created', payload: { orderId: result.id } })
  })

  it('returns the created order DTO', async () => {
    const result = await useCase.execute({ customerId: 'cust-1', items: [{ productId: 'p1', quantity: 1, unitPrice: 10 }] })
    expect(result.status).toBe('pending')
    expect(result.id).toMatch(/^[0-9a-f-]{36}$/)
  })
})
```

**Pattern for cancel/update use cases** — seed the write repo before running:

```ts
it('cancels an existing order', async () => {
  // Seed: create an order first
  const created = await createUseCase.execute({ customerId: 'cust-1', items: [...] })

  // Seed writeRepo so cancel can find it
  // (already there from createUseCase writing to the same FakeWriteRepo)

  const result = await cancelUseCase.execute({ orderId: created.id })
  expect(result.status).toBe('cancelled')
  expect(eventBus.events.at(-1)!.topic).toBe('order.cancelled')
})
```

Or, if cancel and create use separate repo instances, seed `writeRepo.store` directly:
```ts
writeRepo.store.push({ id: 'ord-1', status: 'pending', customerId: 'cust-1', ... })
```

---

## 3. E2E tests

E2E tests exercise the full inbound stack: HTTP request → controller → use case → domain → back out. Infrastructure adapters are replaced with in-memory doubles (the same `doubles.ts` from use case tests, or a shared `_test/e2e/setup.ts`).

This gives fast feedback without test containers while still testing real HTTP routing, request parsing, and response serialization.

```ts
// _test/e2e/setup.ts
import express, { type Express } from 'express'
import { CreateOrderUseCase } from '../../src/application/use-cases/create-order.js'
import { GetOrderUseCase } from '../../src/application/use-cases/get-order.js'
import { CancelOrderUseCase } from '../../src/application/use-cases/cancel-order.js'
import { OrderController } from '../../src/adapters/inbound/http/express/order-controller.js'
import { FakeWriteRepo, FakeReadRepo, FakeCache, FakeEventBus, PassthroughTelemetry } from '../../src/application/use-cases/_test/doubles.js'

export function buildTestApp() {
  const writeRepo = new FakeWriteRepo()
  const readRepo = new FakeReadRepo()
  const cache = new FakeCache()
  const eventBus = new FakeEventBus()
  const telemetry = new PassthroughTelemetry()

  const createOrder = new CreateOrderUseCase(writeRepo, cache, eventBus, telemetry)
  const getOrder = new GetOrderUseCase(readRepo, cache, telemetry)
  const cancelOrder = new CancelOrderUseCase(writeRepo, cache, eventBus, telemetry)

  const controller = new OrderController(createOrder, getOrder, cancelOrder)
  const app: Express = express()
  app.use(express.json())
  app.use('/orders', controller.buildRouter())

  return { app, writeRepo, readRepo, cache, eventBus }
}
```

```ts
// _test/e2e/create-order.e2e.test.ts
import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { buildTestApp } from './setup.js'

describe('POST /orders', () => {
  it('returns 201 with the created order', async () => {
    const { app } = buildTestApp()
    const res = await request(app)
      .post('/orders')
      .send({ customerId: 'cust-1', items: [{ productId: 'p1', quantity: 2, unitPrice: 50 }] })

    expect(res.status).toBe(201)
    expect(res.body.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(res.body.status).toBe('pending')
    expect(res.body.customerId).toBe('cust-1')
  })

  it('returns 400 when customerId is missing', async () => {
    const { app } = buildTestApp()
    const res = await request(app)
      .post('/orders')
      .send({ items: [{ productId: 'p1', quantity: 1, unitPrice: 10 }] })

    expect(res.status).toBe(400)
  })

  it('persists through get', async () => {
    const { app } = buildTestApp()
    const created = await request(app)
      .post('/orders')
      .send({ customerId: 'cust-1', items: [{ productId: 'p1', quantity: 1, unitPrice: 10 }] })

    const fetched = await request(app).get(`/orders/${created.body.id}`)
    expect(fetched.status).toBe(200)
    expect(fetched.body.id).toBe(created.body.id)
  })
})
```

---

## package.json test scripts

Add to each service's `package.json`:

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "vitest run _test/e2e"
  },
  "devDependencies": {
    "vitest": "^1.0.0",
    "supertest": "^6.0.0",
    "@types/supertest": "^6.0.0"
  }
}
```

---

## What NOT to test here

- **Adapter integration tests** (real Postgres, real Kafka) belong in `adapters/outbound/<technology>/_test/`. Only write these when verifying a query or schema mapping is correct. They require real infrastructure (test containers or a dedicated test DB) and are slower — don't include them in the default `vitest run` path. Tag them with `@integration` and run separately.
- **NestJS bootstrap**: NestJS has its own testing module (`@nestjs/testing`). If you're using NestJS, create `_test/` inside the `nest/` adapter directory and use `Test.createTestingModule()` to test the module wiring.
