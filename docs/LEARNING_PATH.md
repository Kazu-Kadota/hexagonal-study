# Learning Path: Hexagonal Architecture with Microservices

This document explains **why each folder and file exists** and what modification it teaches.

## Step 1 — Define bounded contexts (services)

I created two services:

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

- `ports/`: interfaces representing required capabilities.
- use cases (`create-order`, `get-order`, `create-payment`) that depend only on ports.

> Learning: Use cases orchestrate business flow and are stable even if technologies change.

## Step 4 — Outbound adapters (technology implementations)

I mapped each requested technology to adapters:

- MongoDB/Postgres repositories for persistence.
- Redis cache for order lookup.
- Kafka event bus for asynchronous communication.
- Stripe gateway in payments for external payment provider.
- OpenTelemetry adapter for tracing spans.

> Learning: Adapters are plug-ins around ports. Swap implementations without changing use cases.

## Step 5 — Inbound adapters and Infrastructure wiring

HTTP controllers in `adapters/inbound/http` accept requests and call use cases. Also at `bootstrap.ts`, wires concrete adapters into use cases (ex: Inbound Adapter -> Application/use cases -> Domain -> Outbound Adapter)

> Learning: Controllers should be thin translators, not business-logic containers. Composition root keeps dependency creation centralized.

## Step 6 — Event-driven integration

`orders` publishes `order.created`.
`payments` consumes `order.created`, calls Stripe, then publishes `payment.created`.

> Learning: services communicate via events to reduce runtime coupling.

## Step 7 — Observability first

We initialize OpenTelemetry early and wrap use-case execution inside spans.

> Learning: telemetry is a cross-cutting concern handled via adapter/port, not hardcoded in core logic.

## Architecture check questions

- If MongoDB is replaced with PostgreSQL, how many files in `domain/` change? (Expected: zero)
- If Stripe API changes, which layer absorbs impact? (Expected: Stripe adapter)
- If HTTP is replaced by gRPC, do use cases change? (Expected: no)
