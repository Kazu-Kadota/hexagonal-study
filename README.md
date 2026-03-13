# Hexagonal Architecture + Microservices Study Project

This repository is a **hands-on learning lab** for building microservices with **Hexagonal Architecture (Ports and Adapters)** using:

- Node.js + TypeScript
- Express and NestJS
- MongoDB and Postgres
- Redis
- Kafka
- OpenTelemetry
- Stripe

## How this project is structured

As microservice project lab, I created a monolith repository to have a visibility of each services.

Each service (payment and orders) have the next structure:

- `domain/` contains pure business rules like order domain and its changes (like cancel method). Think about the entity: each entity will exist as domain (and probabily as microservice)
- `application/` orchestrates use cases through ports. Example: createOrderUseCase will: create a order in memory (Order.create) -> create a dto to use as object -> create a idempotency -> save in a database (application shouldn't know which database we are using, for it, don't matter) -> set a cache -> publish a event called `order.created` -> return orderDTO.
- `adapters/` connect external technologies (MongoDB, Redis, Kafka, Stripe, HTTP, telemetry). There is a inbound (from external service to our server: listen) and outbound (from our server to external service: request) adapters, and each one have their services implemented by ports from application/ports. See `adapters/outbound/database` to understand better in practice. 
- `infrastructure/` wires dependencies. All services like Cache, Database or even the configuration of the service, will exist in this directory. The ports existent in this directory is to maintain decoupled of external services. See `infrastructure/database` to understand better in practice.

## Microservices in this lab

1. `orders` service
   - Receives order requests through HTTP.
   - Persists orders in Postgres.
   - Publishes `order.created` events to Kafka.
   - Caches order reads in Redis.

2. `payments` service
   - Consumes order events (simulated polling consumer for learning simplicity).
   - Creates Stripe PaymentIntents.
   - Persists payments in Postgres.
   - Publishes `payment.created` events.

## Getting started

### 1) Install dependencies

```bash
npm install
```

### 2) Start infrastructure

```bash
docker compose up -d
```

### 3) Configure environment

Copy `.env.example` to `.env` and set values (especially Stripe keys).

### 4) Run services

```bash
npm run dev --workspace @hex/orders
npm run dev --workspace @hex/payments
```

## Learning guide

Read `docs/LEARNING_PATH.md` for a step-by-step explanation of each architectural decision and modification.
