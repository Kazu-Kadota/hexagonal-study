# Hexagonal Architecture + Microservices Study Project

This repository is a **hands-on learning lab** for building microservices with **Hexagonal Architecture (Ports and Adapters)** using:

- Node.js + TypeScript (Express)
- MongoDB
- Redis
- Kafka
- OpenTelemetry
- Stripe

## Why this project exists

You asked to learn architecture *in practice*. So this repo is intentionally structured to make architecture visible in code:

- `domain/` contains pure business rules.
- `application/` orchestrates use cases through ports.
- `adapters/` connect external technologies (MongoDB, Redis, Kafka, Stripe, HTTP, telemetry).
- `infrastructure/` wires dependencies.

## Microservices in this lab

1. `orders` service
   - Receives order requests through HTTP.
   - Persists orders in MongoDB.
   - Publishes `order.created` events to Kafka.
   - Caches order reads in Redis.

2. `payments` service
   - Consumes order events (simulated polling consumer for learning simplicity).
   - Creates Stripe PaymentIntents.
   - Persists payments in MongoDB.
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
