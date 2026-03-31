# Domain Errors

## Error hierarchy

Define all domain errors in `src/domain/errors.ts`. This file is the only place in the codebase that defines error types — adapters import from here, never the reverse.

```ts
// src/domain/errors.ts

export class DomainError extends Error {
  constructor(message: string) {
    super(message)
    this.name = this.constructor.name
    // Preserves correct stack trace in V8
    if (Error.captureStackTrace) Error.captureStackTrace(this, this.constructor)
  }
}

/** Entity does not exist */
export class NotFoundError extends DomainError {}

/** Operation is invalid given the entity's current state */
export class ConflictError extends DomainError {}

/** Input violates a business rule or invariant */
export class ValidationError extends DomainError {}
```

These three cover the vast majority of cases. Add subtypes only when adapters need to distinguish them (e.g., `PaymentDeclinedError extends ConflictError`).

### Throwing in the domain entity

```ts
// src/domain/order.ts
import { ConflictError, ValidationError } from './errors.js'

static create(dto: CreateOrderDTO): Order {
  if (!dto.customerId) throw new ValidationError('customerId is required')
  if (!dto.items.length) throw new ValidationError('order must have at least one item')
  // ...
}

cancel(): void {
  if (this.status === OrderStatus.cancelled)
    throw new ConflictError(`Order ${this.id} is already cancelled`)
  // ...
}
```

---

## Logging convention

| Situation | Log level | Reason |
|---|---|---|
| `DomainError` (any subclass) | `console.warn` | Expected — a business rule was violated; worth noting but not an incident |
| Unknown / infrastructure error | `console.error` | Unexpected — needs attention |

---

## HTTP (Express) error handler

Add a single error-handler middleware in the Express bootstrap. Keep route handlers clean — they only throw, never handle errors themselves.

```ts
// src/adapters/inbound/http/express/error-handler.ts
import type { Request, Response, NextFunction } from 'express'
import { DomainError, NotFoundError, ConflictError, ValidationError } from '../../../../domain/errors.js'

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ValidationError) {
    console.warn(err.message)
    res.status(422).json({ error: err.message })
    return
  }
  if (err instanceof NotFoundError) {
    console.warn(err.message)
    res.status(404).json({ error: err.message })
    return
  }
  if (err instanceof ConflictError) {
    console.warn(err.message)
    res.status(409).json({ error: err.message })
    return
  }
  if (err instanceof DomainError) {
    // Catch-all for any other domain error not explicitly mapped above
    console.warn(err.message)
    res.status(422).json({ error: err.message })
    return
  }
  // Unknown — infrastructure failure
  console.error(err)
  res.status(500).json({ error: 'Internal server error' })
}
```

Register it last in `bootstrap.ts`, after all routes:

```ts
app.use('/orders', orderController.buildRouter())
app.use(errorHandler)  // ← must be after all routes
```

Route handlers use `next(err)` or just throw (Express 5 / async wrappers catch throws automatically):

```ts
// In controller
router.post('/', async (req, res, next) => {
  try {
    const result = await this.createOrder.execute(req.body)
    res.status(201).json(result)
  } catch (err) {
    next(err)
  }
})
```

---

## gRPC error handler

```ts
import { status as GrpcStatus } from '@grpc/grpc-js'
import { DomainError, NotFoundError, ConflictError, ValidationError } from '../../../../domain/errors.js'

export function toGrpcError(err: unknown): { code: number; message: string } {
  if (err instanceof ValidationError) { console.warn(err.message); return { code: GrpcStatus.INVALID_ARGUMENT, message: err.message } }  // 422 equivalent
  if (err instanceof NotFoundError)   { console.warn(err.message); return { code: GrpcStatus.NOT_FOUND, message: err.message } }
  if (err instanceof ConflictError)   { console.warn(err.message); return { code: GrpcStatus.ALREADY_EXISTS, message: err.message } }
  if (err instanceof DomainError)     { console.warn(err.message); return { code: GrpcStatus.FAILED_PRECONDITION, message: err.message } }
  console.error(err)
  return { code: GrpcStatus.INTERNAL, message: 'Internal error' }
}
```

---

## WebSocket error handler

```ts
import { DomainError, NotFoundError, ConflictError, ValidationError } from '../../../../domain/errors.js'

export function toWsError(err: unknown): { code: number; message: string } {
  if (err instanceof ValidationError) { console.warn(err.message); return { code: 4400, message: err.message } }
  if (err instanceof NotFoundError)   { console.warn(err.message); return { code: 4404, message: err.message } }
  if (err instanceof ConflictError)   { console.warn(err.message); return { code: 4409, message: err.message } }
  if (err instanceof DomainError)     { console.warn(err.message); return { code: 4422, message: err.message } }
  console.error(err)
  return { code: 4500, message: 'Internal server error' }
}

// In the WebSocket message handler:
// ws.send(JSON.stringify({ type: 'error', ...toWsError(err) }))
```

---

## GraphQL error handler

```ts
import { GraphQLError } from 'graphql'
import { DomainError, NotFoundError, ConflictError, ValidationError } from '../../../../domain/errors.js'

export function toGraphQLError(err: unknown): GraphQLError {
  if (err instanceof ValidationError) { console.warn(err.message); return new GraphQLError(err.message, { extensions: { code: 'BAD_USER_INPUT' } }) }
  if (err instanceof NotFoundError)   { console.warn(err.message); return new GraphQLError(err.message, { extensions: { code: 'NOT_FOUND' } }) }
  if (err instanceof ConflictError)   { console.warn(err.message); return new GraphQLError(err.message, { extensions: { code: 'CONFLICT' } }) }
  if (err instanceof DomainError)     { console.warn(err.message); return new GraphQLError(err.message, { extensions: { code: 'UNPROCESSABLE' } }) }
  console.error(err)
  return new GraphQLError('Internal server error', { extensions: { code: 'INTERNAL_SERVER_ERROR' } })
}
```
