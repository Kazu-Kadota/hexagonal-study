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

This skill generates a production-patterned TypeScript microservice using **Hexagonal Architecture**
(Ports & Adapters), **Clean Architecture** layering, **Domain-Driven Design** entities, and
**Event-Driven** communication.

The reference implementation: `https://github.com/Kazu-Kadota/hexagonal-study/services/orders` and `.../payments`.
If accessible, always read actual source as ground truth.

---

## How this skill works — state machine

This skill is designed to be executed in **small, reviewable phases**. Each agent invocation completes
exactly one phase, writes state to disk, and pauses for user review before the next phase begins.

**On every invocation, start here:**

1. Look for `services/<domain>/claude-progress.json`
   - **Not found** → this is a new scaffold → run **Phase 0**
   - **Found, `awaiting_user_review: true`** → tell the user the current phase is done and waiting. Ask if they want to continue to the next phase
   - **Found, `awaiting_user_review: false`** → read `current_phase` and jump directly to that phase
2. If the user is asking to **add something to an existing service** (a new entity, a consumer, error handling, tests, Terraform) and no progress file exists → go to **Targeted Additions** at the bottom

---

## microservice-preferences.json

Lives at `services/<domain>/microservice-preferences.json`. First written in Phase 0, but **updated
any time new information is gathered** — including mid-scaffold if the user introduces a new technology
or changes a decision.

This file is **not a rigid schema**. It is an organic record of every decision the user has made about
this microservice. Write keys that reflect what was actually said, using natural names. If the user says
"use Postgres for writes and MongoDB for reads", write that. If they say "I want to use Axios to call
the payment service", write that too. If they later say "actually add Redis for caching", append it.

The file must contain enough information for a fresh agent (with no conversation history) to understand
the full picture of the microservice — its domain, its technologies, and every architectural decision
made so far.

> **At the start of every phase:** read `microservice-preferences.json` and reason about whether you
> have enough information to complete that phase. If anything is unclear or missing, ask the user
> before writing any file — even if that question is not in Phase 0's list.
>
> **Never ask about something already answered in `microservice-preferences.json`.**

---

## claude-progress.json

Lives at `services/<domain>/claude-progress.json`. Created at end of Phase 0, updated after each phase.

```json
{
  "service": "orders",
  "service_path": "services/orders",
  "current_phase": "3b",
  "completed_phases": ["0", "1", "2", "3a"],
  "awaiting_user_review": true,
  "files_created": [
    "services/orders/src/domain/order.ts"
  ],
  "key_decisions": {
    "span_prefix": "orders",
    "status_enum_values": ["pending", "cancelled"],
    "entity_id_strategy": "crypto.randomUUID()",
    "kafka_topic_prefix": "order"
  },
  "last_updated": "2026-03-31T00:00:00.000Z"
}
```

`key_decisions` captures naming conventions and structural choices that must stay consistent across
all phases and agents. Add new entries whenever a phase introduces a decision that later phases will
need. Never re-derive them — trust what is recorded here.

---

## Phase completion protocol

At the end of **every** phase:

1. Update `claude-progress.json`:
   - Move current phase to `completed_phases`
   - Set `current_phase` to the next phase
   - Append all created files to `files_created`
   - Add any new entries to `key_decisions`
   - Set `awaiting_user_review: true`
   - Update `last_updated`
2. Update `microservice-preferences.json` with any new decisions made during this phase
3. Tell the user:
   - What was created (list the files)
   - Any key decisions made
   - What the next phase will generate
   - **"Review these files and start a new conversation saying 'continue the \<domain\> scaffold' when ready."**

> **TDD mode:** if the user asked for TDD, before implementing each phase write failing tests first.
> Implement only until those tests pass, then refactor. See `references/testing.md` for file locations.

---

## Phase 0 — Gather context

Before writing any file, understand what the user wants to build. The goal is to leave Phase 0 with
enough clarity to scaffold every layer confidently — not to fill in a form.

**Start from what the user already told you.** If they said "I want an orders service with Postgres",
you already know the domain and the write database. Ask only what is still missing.

Use the questions below as a **checklist of areas to cover**, not a rigid script. Some answers will
be obvious from context; others will surface naturally in conversation. If the user's answer opens
a new question (e.g. "I want to call the payment service" → what protocol? what authentication?),
follow it.

### Areas to clarify

- **Domain and entity** — what is the bounded context? What is the aggregate root? What fields does it have?
- **States and transitions** — what status values exist? What operations change state?
- **Use cases** — what actions does the service expose?
- **Inbound** — how will this service be called? HTTP (Express, NestJS)? Event-driven (Kafka consumer, SQS poller)? Both? Something else?
- **Write persistence** — where does the service write data? Which technology?
- **Read persistence** — same as write, or a separate read model (CQRS)? If separate, which sync strategy? See `references/cqrs-sync.md`.
- **Cache** — is there a cache layer? Which technology?
- **Messaging / events** — does the service publish events? Which broker?
- **Telemetry** — is observability required? Which implementation?
- **External integrations** — does the service call other services or third-party APIs? How (HTTP, gRPC, SDK)?
- **Monorepo** — adding to an existing monorepo or creating from scratch?
- **TDD** — should tests be written layer by layer before implementation?
- **Terraform** — scaffold AWS infrastructure after the app code?
- **Multiple aggregates** — more than one entity in this service?

You are not limited to these questions. If something about the user's domain or stack would affect
the scaffold and isn't answered yet, ask.

### After all context is gathered

- Write `services/<domain>/microservice-preferences.json` with everything decided so far
- Create `services/<domain>/claude-progress.json` with `current_phase` set to the next applicable phase, `completed_phases: ["0"]`, empty `files_created`, empty `key_decisions`
- Apply **Phase completion protocol**

---

## Phase 1 — Monorepo root

*Only if creating from scratch. If the user is adding to an existing monorepo, skip to Phase 2.*

Read `references/monorepo.md` for templates.

Before writing: check `microservice-preferences.json` for any monorepo-level decisions (workspace
structure, docker services needed). Generate only what the user's stack actually requires — if there
is no Kafka, there is no Kafka service in docker-compose, and so on.

Files to generate:
- `package.json` (workspaces: `["services/*"]`)
- `tsconfig.json`
- `docker-compose.yml`

---

## Phase 2 — Service skeleton

Create the directory tree and non-code config files. No TypeScript implementation yet.

Before writing: read `microservice-preferences.json` and reason about the full shape of the service.
Which directories will exist? What technologies drive the structure? If the user mentioned a
technology that would create a new directory (e.g. a third-party Axios client), plan a slot for it
in the outbound adapters now. If the directory structure is unclear for any technology, ask.

Files to generate:
- `services/<domain>/package.json`
- `services/<domain>/tsconfig.json`
- `services/<domain>/.env.example`
- `services/<domain>/prisma/schema.prisma` and `prisma.config.ts` — only if the user's write DB uses Prisma

Create the skeleton directory structure adapted to the decided stack. For **multiple aggregates**:
read the multiple-aggregates structure section below before generating.

---

## Phase 3a — Domain layer

Read `references/domain.md`.

Before writing: verify in `microservice-preferences.json` that you know the entity fields, status
values, and all transition operations. If any is missing, ask now — generating a wrong domain means
every later phase diverges.

Files to generate (one per aggregate when there are multiple):
- `src/domain/<entity>.ts`

Key rules — all enforced here:
- Private constructor, `static create(dto)`, `static reconstitute(raw)`, `toDTO()`
- Status as `as const` object, never TypeScript `enum`
- State transition methods mutate private fields and update `updatedAt`
- Zero framework imports

Record in `key_decisions`: `status_enum_values`, `entity_id_strategy`, `transition_method_names`.

---

## Phase 3b — Application ports

Read `references/ports.md`.

Before writing: reason through every outbound concern the service has — persistence, cache,
messaging, telemetry, and any external integrations mentioned by the user. Each concern needs a port.
If the user mentioned calling a third-party API (e.g. FCM, a payment gateway), there must be a port
for it here, even if that technology is not one of the "standard" list.

Files to generate:
- `src/application/ports/inbound/http.ts` — one abstract method per use case
- One read port and one write port per persistence store decided by the user
- Cache port — if the user has a cache layer
- Messaging port — if the user publishes events
- Telemetry port — if the user has observability
- One port per external integration the user mentioned

For **multiple aggregates**: each aggregate that uses a given port gets its own subfolder under it.
Only create ports for what an aggregate actually uses.

All ports are **abstract classes**, not interfaces. Naming: `I<Domain><Category>Port`.

Record in `key_decisions`: `port_naming_pattern`.

---

## Phase 3c — Use cases

Read `references/use-cases.md`.

Before writing: verify that every use case listed in `microservice-preferences.json` is accounted
for, and that every dependency (ports) generated in Phase 3b is available to wire. If the user
mentioned a use case that involves a technology not yet in the preferences (e.g. "send a push
notification after creating"), surface that now and update `microservice-preferences.json`.

Files to generate:
- One file per use case: `src/application/use-cases/<verb>-<entity>.ts`
- For multiple aggregates: `src/application/use-cases/<entity>/<verb>-<entity>.ts`

One file, one class, one public `execute()` method. Constructor-inject all dependencies.
Every `execute()` wraps its entire body in `this.telemetry.span("<domain>.<action>", ...)`.

Standard patterns:
- **Create**: `Entity.create()` → `toDTO()` → write DB → set cache → publish event → return DTO
- **Get**: cache lookup → DB read fallback → set cache → return
- **Cancel/Update**: read → `Entity.reconstitute()` → transition → `toDTO()` → write → cache → event
- **Delete**: write `delete()` → cache `delete()` → publish event

Record in `key_decisions`: `span_prefix`, `span_naming_example`.

---

## Phase 3d-1 — Outbound adapters: database

Read `references/adapters-outbound.md` (database section).

Before writing: check `microservice-preferences.json` for the decided write and read databases.
For each database technology the user chose, generate the corresponding adapter(s).
For **multiple aggregates**: each aggregate gets its own subfolder within the adapter.

Generate exactly the adapters that match the user's decisions — no more, no less.

---

## Phase 3d-2 — Outbound adapters: cache, messaging, telemetry, external integrations

Read `references/adapters-outbound.md` (cache, messaging, telemetry sections).

Before writing: check `microservice-preferences.json` for every outbound concern beyond the
database — cache, event broker, telemetry, and any external integrations (HTTP clients,
third-party SDKs). Generate an adapter for each one.

For external integrations not covered by the standard reference file (e.g. an Axios HTTP client to
an internal service, a Firebase SDK), implement the adapter following the same port-implements
pattern: one class, implements the port from Phase 3b, no business logic.

Key conventions to follow regardless of technology:
- Cache adapters always include a TTL in `set()`
- Message topic names follow `<entity>.<past-tense-verb>` (e.g. `order.created`)

Record in `key_decisions`: any topic naming, cache key pattern, TTL defaults introduced here.

---

## Phase 3e — Infrastructure connections

Read `references/infrastructure.md`.

Before writing: `config.ts` is the only place in the entire codebase that reads `process.env`.
Every environment variable the service needs must be declared in the Zod schema here.
Check `microservice-preferences.json` to know which connections are needed, then generate one
connection class per infrastructure technology.

Files to generate:
- `src/infrastructure/config.ts` — Zod schema, reads `process.env`, exports typed `config`
- One connection class per infrastructure technology (database, cache, messaging, telemetry)

Pattern: lazy singleton — check `if (this.client) return` at top of `connect()`.
Infrastructure connections are **shared across all aggregates** — never duplicated.

---

## Phase 3f-1 — Inbound adapter: HTTP

Read `references/adapters-inbound.md`.

Before writing: check `microservice-preferences.json` for which HTTP framework(s) the user chose.
If the user mentioned Express, generate the Express adapter. If NestJS, generate NestJS.
If both, generate both. If the user has not yet decided on an HTTP framework, ask now.

**Express** files:
- `src/adapters/inbound/http/express/<entity>-controller.ts`
- `src/adapters/inbound/http/express/bootstrap.ts` — composition root, graceful shutdown with `Promise.allSettled`
- DTOs under `src/adapters/inbound/http/express/dtos/`

**NestJS** files:
- `src/adapters/inbound/http/nest/token.ts` — `Symbol` constants for every injectable
- `src/adapters/inbound/http/nest/<entity>.module.ts`
- `src/adapters/inbound/http/nest/<entity>.service.ts`
- `src/adapters/inbound/http/nest/<entity>.controller.ts`
- `src/adapters/inbound/http/nest/infra/client-shutdown.service.ts`
- `src/adapters/inbound/http/nest/dtos/<entity>.ts`
- `src/adapters/inbound/http/nest/bootstrap.ts`

For **multiple aggregates**: one controller per aggregate, single `bootstrap.ts` wires all of them.

---

## Phase 3f-2 — Inbound adapter: messaging consumer

Read `references/adapters-inbound.md` (messaging consumer section).

Before writing: check `microservice-preferences.json` for whether the service consumes events and
which topics. If the user mentioned that the service reacts to events from other services but has
not specified the topics or broker, ask now.

Files to generate:
- `src/adapters/inbound/messaging/<broker>/<entity>-consumer.ts` — subscribes to topics, parses, delegates to use cases. No business logic here. Unknown topics and malformed messages are logged and skipped.
- `src/adapters/inbound/messaging/<broker>/bootstrap.ts` — separate composition root for the consumer

---

## Phase 3g — Entry point

File to generate:
- `src/main.ts` — bootstraps telemetry first, then all inbound adapters in the order the user decided

```ts
import { config } from "./infrastructure/config.js";

async function bootstrap() {
  // 1. Start telemetry (if applicable)
  // 2. Start HTTP server (Express / NestJS / both — per preferences)
  // 3. Start messaging consumer (if applicable, runs in parallel with HTTP)
}

bootstrap().catch((error) => { console.error(error); process.exit(1); });
```

All local imports use `.js` extension (required by NodeNext module resolution).

---

## Phase 4 — Events & layering verification

No new files. Read the generated code and verify:

- Layering rules (table below) have no violations
- Message topic names follow `<entity>.<past-tense-verb>` convention
- Event payload shape: `{ type: "entity.verb", payload: { ... } }`
- Shared event type definitions in `shared/events/` at monorepo root
- All local imports use `.js` extension

Fix any violations before marking this phase complete.

---

## Phase 5-1 — Terraform: service files

Read `references/terraform.md`.

*Only if the user asked for Terraform. If not mentioned, ask whether they want it before starting.*

Gather any Terraform-specific context not yet in `microservice-preferences.json`:
- Compute type (Lambda zip, Lambda container, or ECS Fargate?)
- Which AWS resources and how many of each (SQS queues, SNS topics, DynamoDB tables, etc.)
- VPC — new or existing?
- CI/CD system (GitHub Actions is the default)
- Environment names (default: `dev`, `staging`, `prd`)
- S3 bucket and DynamoDB lock table for remote state

Files to generate:
- `services/<domain>/terraform/main.tf`, `variables.tf`, `outputs.tf`, `locals.tf`, `data.tf`
- `services/<domain>/terraform/backend.tf` — state key only; bucket and region go in `.tfbackend` files
- `services/<domain>/terraform/environments/<env>.tfvars` and `<env>.tfbackend` for each environment
- `services/<domain>/terraform/Makefile`

---

## Phase 5-2 — Terraform: modules

Read `references/terraform-modules.md`.

Check which modules already exist in `terraform/modules/` before creating any.
Only generate modules this service needs that are not already present.

---

## Phase 6a — Tests: domain

Read `references/testing.md`.

*Only if the user requested tests. If not mentioned, ask before starting.*

Files to generate:
- `src/domain/_test/<entity>.test.ts` — pure TypeScript, no mocks, covers every validation branch in `create()` and every guard in transition methods

---

## Phase 6b — Tests: use cases

Read `references/testing.md`.

Files to generate:
- `src/application/use-cases/_test/doubles.ts` — test doubles that **extend abstract port classes** (not `vi.fn()`)
- `src/application/use-cases/_test/<use-case>.test.ts` — one file per use case

---

## Phase 6c — Tests: E2E

Read `references/testing.md`.

Files to generate:
- `src/_test/e2e/setup.ts` — builds the app with in-memory adapters; no real database or broker
- `src/_test/e2e/<action>.e2e.test.ts` — supertest against the real controller/use case/domain stack

Add `"test": "vitest run"` and `"test:e2e": "vitest run _test/e2e"` to `package.json`.

---

## Phase 7 — Quality checklist

No new files. Read every generated file and verify:

- [ ] `domain/<entity>.ts` has no external imports
- [ ] All ports are abstract classes, not interfaces
- [ ] Every use case wraps execute body in `telemetry.span()`
- [ ] Cache adapter always includes TTL in `set()`
- [ ] `process.env` only accessed inside `infrastructure/config.ts`
- [ ] Express bootstrap has graceful shutdown with `Promise.allSettled`
- [ ] NestJS `token.ts` has a Symbol for every injectable
- [ ] Prisma schema enums match domain entity enum values exactly
- [ ] Span names follow `<domain>.<action>` convention
- [ ] Message topic names follow `<entity>.<past-tense-verb>` convention
- [ ] Domain tests cover all validation branches
- [ ] Use case test doubles extend abstract port classes
- [ ] E2E setup uses in-memory adapters
- [ ] All local imports use `.js` extension
- [ ] Terraform `backend.tf` has only the state key; all environments have `.tfvars` + `.tfbackend`

Fix any failures. When all pass: set `current_phase: "done"` in `claude-progress.json`.

---

## Targeted additions

When the user wants to add to an already-scaffolded service without a full scaffold:

- **Add a new entity/aggregate** → run Phases 3a → 3b → 3c → 3d-1 → 3d-2 for the new aggregate. If the new aggregate requires a technology not already in the service (e.g. a new external API), ask the user about it and update `microservice-preferences.json` before generating. Then update the shared bootstrap.
- **Add a messaging consumer** → run Phase 3f-2. Read existing ports and use cases before wiring.
- **Add error handling** → read `references/errors.md`. Generate `src/domain/errors.ts` and update the inbound adapter with an error-handler middleware.
- **Add tests** → run Phases 6a, 6b, 6c as needed.
- **Add Terraform** → run Phases 5-1 and 5-2. Gather Terraform context first.

In all cases: read existing code before generating anything. Respect decisions already made.

---

## Layering rules

| Layer | Can import | Cannot import |
|---|---|---|
| `domain/` | nothing | everything |
| `application/` | `domain/`, own `ports/` | adapters, infrastructure, Express, NestJS, Prisma |
| `adapters/` | `application/`, `domain/` | other adapters, infrastructure (pass via constructor) |
| `infrastructure/` | own connections | domain logic, application logic |
| `bootstrap.ts` | all of the above | — it is the composition root |

---

## Multiple aggregates structure

When the service has more than one aggregate, use a layer-first structure with aggregate subfolders:

- `src/domain/<entity>/` per aggregate
- `src/application/ports/outbound/database/<entity>/` per aggregate
- `src/application/use-cases/<entity>/` per aggregate
- One controller per aggregate in `src/adapters/inbound/http/express/<entity>/`, single `bootstrap.ts`
- Infrastructure connections are **shared** — not duplicated per aggregate
- Only create ports and adapters for what an aggregate actually uses

---

## Reference files

- `references/monorepo.md` — root package.json, tsconfig, docker-compose templates
- `references/domain.md` — domain entity template with full annotated example
- `references/ports.md` — all port abstract classes with annotations
- `references/use-cases.md` — use case templates for create/get/cancel/delete patterns
- `references/adapters-outbound.md` — outbound adapter implementations (Postgres, Mongo, Redis, Kafka, OTel)
- `references/adapters-inbound.md` — Express controller+bootstrap, NestJS module+service+controller+tokens, messaging consumer
- `references/infrastructure.md` — connection classes, config.ts Zod schema, Prisma schema template
- `references/testing.md` — test structure, domain/use-case/E2E patterns, Vitest setup
- `references/errors.md` — DomainError hierarchy, HTTP/gRPC/WebSocket/GraphQL translation patterns
- `references/cqrs-sync.md` — read model sync strategies (inline, outbox, event-driven, CDC) with tradeoff table
- `references/terraform.md` — Terraform scaffold: file templates, Makefile, environment files, GitHub Actions CI/CD workflow
- `references/terraform-modules.md` — module templates for vpc, sqs, sns, eventbridge, postgres-rds, dynamodb, redis, msk-kafka, ecs-fargate, lambda, api-gateway, route53, ssm
