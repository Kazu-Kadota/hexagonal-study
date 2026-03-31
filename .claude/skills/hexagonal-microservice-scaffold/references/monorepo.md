# Monorepo Setup Templates

These templates are only needed when creating a brand-new repository from scratch.
If you're adding a service to an existing monorepo, skip to the service-level files.

As the orientation written in SKILL.md, this also don't need to be followed strictly: for example pacjage.json don't need to be the same, you will import packages that will be necessary only to run the application as the devDependencies also.

---

## Root `package.json`

```json
{
  "name": "my-monorepo",
  "private": true,
  "workspaces": [
    "services/*"
  ],
  "scripts": {
    "build": "npm run build --workspaces",
    "lint": "npm run lint --workspaces",
    "test": "npm run test --workspaces"
  }
}
```

---

## Service `package.json` (`services/<domain>/package.json`)

```json
{
  "name": "@myapp/<domain>",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/main.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/main.js",
    "lint": "tsc --noEmit",
    "test": "node --test dist/**/*.test.js",
    "prisma:generate": "prisma generate",
    "prisma:migrate:dev": "prisma migrate dev",
    "prisma:migrate:deploy": "prisma migrate deploy",
    "prisma:studio": "prisma studio"
  },
  "dependencies": {
    "@nestjs/common": "^11.0.0",
    "@nestjs/core": "^11.0.0",
    "@nestjs/platform-express": "^11.0.0",
    "@opentelemetry/api": "^1.9.0",
    "@opentelemetry/exporter-trace-otlp-http": "^0.200.0",
    "@opentelemetry/resources": "^2.0.0",
    "@opentelemetry/sdk-trace-base": "^2.0.0",
    "@opentelemetry/semantic-conventions": "^1.0.0",
    "@prisma/adapter-pg": "^7.0.0",
    "@prisma/client": "^7.0.0",
    "class-transformer": "^0.5.1",
    "class-validator": "^0.15.1",
    "express": "^5.0.0",
    "ioredis": "^5.0.0",
    "kafkajs": "^2.2.4",
    "mongodb": "^7.0.0",
    "zod": "^4.0.0"
  },
  "devDependencies": {
    "@nestjs/cli": "^11.0.0",
    "@nestjs/schematics": "^11.0.0",
    "@nestjs/testing": "^11.0.0",
    "@types/express": "^5.0.0",
    "@types/node": "^22.0.0",
    "dotenv": "^16.0.0",
    "prisma": "^7.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.0.0"
  }
}
```

---

## Service `tsconfig.json` (`services/<domain>/tsconfig.json`)

> **NodeNext import rule**: `"moduleResolution": "NodeNext"` requires `.js` extensions on all local imports, even though the source files are `.ts`. TypeScript maps `./order.js` → `./order.ts` at compile time, and Node.js finds the compiled `.js` at runtime. Omitting the extension causes `ERR_MODULE_NOT_FOUND` at runtime.
> ```ts
> import { Order } from './domain/order.js'   // ✅
> import { Order } from './domain/order'       // ❌ breaks at runtime
> ```

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "./",
    "declaration": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true
  },
  "include": ["src"]
}
```

`emitDecoratorMetadata` and `experimentalDecorators` are required for NestJS.
`module: "NodeNext"` and `moduleResolution: "NodeNext"` enforce ESM with explicit `.js` extensions in imports.

---

## Service `.env.example` (`services/<domain>/.env.example`)

```env
# App
<DOMAIN>_PORT=3001

# Postgres (write database by default)
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres

# MongoDB (read database by default, CQRS read model)
MONGO_URI=mongodb://localhost:27017

# Database adapter selection (postgres | mongodb)
<DOMAIN>_DB_WRITE_ADAPTER=postgres
<DOMAIN>_DB_READ_ADAPTER=mongodb

# Redis
REDIS_URL=redis://localhost:6379

# Kafka
KAFKA_BROKERS=localhost:9092
KAFKA_CLIENT_ID=my-monorepo

# OpenTelemetry
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
```

---

## `docker-compose.yml` (root level)

```yaml
services:
  mongo:
    image: mongo:7
    ports:
      - "27017:27017"

  postgres:
    image: postgres:16
    container_name: platform-postgres
    restart: unless-stopped
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_DB=postgres
    ports:
      - "5432:5432"
    networks:
      - platform-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d postgres"]
      interval: 5s
      timeout: 2s
      retries: 20
    volumes:
      - postgres_data:/var/lib/postgresql/data
    command: postgres -c listen_addresses='*'

  redis:
    image: redis:7
    ports:
      - "6379:6379"

  zookeeper:
    image: confluentinc/cp-zookeeper:7.5.0
    environment:
      ZOOKEEPER_CLIENT_PORT: 2181
      ZOOKEEPER_TICK_TIME: 2000

  kafka:
    image: confluentinc/cp-kafka:7.5.0
    depends_on:
      - zookeeper
    ports:
      - "9092:9092"
    environment:
      KAFKA_BROKER_ID: 1
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://localhost:9092
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1

  otel-collector:
    image: otel/opentelemetry-collector:0.97.0
    command: ["--config=/etc/otelcol/config.yaml"]
    volumes:
      - ./otel-collector-config.yaml:/etc/otelcol/config.yaml
    ports:
      - "4318:4318"

networks:
  platform-network:

volumes:
  postgres_data:
```

---

## `otel-collector-config.yaml` (root level)

```yaml
receivers:
  otlp:
    protocols:
      http:
        endpoint: 0.0.0.0:4318

exporters:
  debug:
    verbosity: detailed

service:
  pipelines:
    traces:
      receivers: [otlp]
      exporters: [debug]
```

---

## Shared events (`shared/events/contracts.md`)

Document your Kafka event schemas here for cross-service type safety:

```markdown
# Shared Event Contracts

## order.created
Producer: orders service
```json
{
  "type": "order.created",
  "payload": {
    "orderId": "uuid",
    "customerId": "uuid",
    "amount": 100,
    "currency": "usd",
    "idempotencyKey": "uuid"
  }
}
```

## payment.created
Producer: payments service
```json
{
  "type": "payment.created",
  "payload": {
    "paymentId": "uuid",
    "orderId": "uuid",
    "stripePaymentIntentId": "pi_xxx",
    "status": "created",
    "idempotency": "uuid"
  }
}
```
```

For stronger type safety, create TypeScript types in `shared/events/` and import them in both producer and consumer services.
