# Learning Path: Hexagonal Architecture with Microservices

This document explains **why each folder and file exists** and what modification it teaches.

## Step 1 — Define bounded contexts (services)

We created two services:

- `orders` for order creation and retrieval.
- `payments` for payment creation from orders.

> Learning: In microservices, each service owns a business capability and data.

## Step 2 — Start from the domain

In each service, `domain/` contains pure models and business rules:

- `orders/domain/order.ts`: validates amount > 0 and creates the order aggregate.
- `payments/domain/payment.ts`: builds payment record entity.

> Learning: Domain code should not import Express, MongoDB, Kafka, Redis, Stripe, etc.

## Step 3 — Application use cases and ports

In `application/`, we created:

- `ports.ts`: interfaces representing required capabilities.
- use cases (`create-order`, `get-order`, `create-payment`) that depend only on ports.

> Learning: Use cases orchestrate business flow and are stable even if technologies change.

## Step 4 — Outbound adapters (technology implementations)

We mapped each requested technology to adapters:

- MongoDB repositories for persistence.
- Redis cache for order lookup.
- Kafka event bus for asynchronous communication.
- Stripe gateway in payments for external payment provider.
- OpenTelemetry adapter for tracing spans.

> Learning: Adapters are plug-ins around ports. Swap implementations without changing use cases.

## Step 5 — Inbound adapters

HTTP controllers in `adapters/inbound/http` accept requests and call use cases.

> Learning: Controllers should be thin translators, not business-logic containers.

## Step 6 — Infrastructure wiring

`main.ts` in each service wires concrete adapters into use cases.

> Learning: Composition root keeps dependency creation centralized.

## Step 7 — Event-driven integration

`orders` publishes `order.created`.
`payments` consumes `order.created`, calls Stripe, then publishes `payment.created`.

> Learning: services communicate via events to reduce runtime coupling.

## Step 8 — Observability first

We initialize OpenTelemetry early and wrap use-case execution inside spans.

> Learning: telemetry is a cross-cutting concern handled via adapter/port, not hardcoded in core logic.

## Step 9 — Practical exercises

1. Add `CancelOrderUseCase` and publish `order.cancelled`.
2. Add idempotency key handling in payment creation.
3. Replace Express adapter with NestJS controller while keeping use cases unchanged.
4. Add a second cache adapter (in-memory) and switch by environment variable.

## Architecture check questions

- If MongoDB is replaced with PostgreSQL, how many files in `domain/` change? (Expected: zero)
- If Stripe API changes, which layer absorbs impact? (Expected: Stripe adapter)
- If HTTP is replaced by gRPC, do use cases change? (Expected: no)
