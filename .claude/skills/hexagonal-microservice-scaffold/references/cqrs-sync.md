# CQRS Read Model Synchronisation

CQRS is opt-in — only apply it when the user explicitly asks for separate read and write stores. When they do, ask which sync strategy fits their context before writing any adapter code. The table below is a decision aid, not a prescription.

---

## Strategy comparison

| Strategy | Consistency | Complexity | Infra needed | Best when |
|---|---|---|---|---|
| **Inline sync** | Strong (or partial failure) | Low | None extra | Simple services, low write volume, latency budget allows two writes |
| **Transactional outbox** | Eventual, durable | Medium | Outbox table + poller/worker | You need guaranteed delivery without a message broker |
| **Event-driven (publish → consume)** | Eventual | Medium | Event bus (Kafka, SNS, EventBridge…) | You already have an event bus; fan-out to multiple read models |
| **CDC (Change Data Capture)** | Eventual | High (infra) | Debezium / DB log reader | Zero app-code change needed; migrating existing schemas |
| **No CQRS** | Strong | None | None | Reads don't justify separate model; simpler is better |

---

## When to use each

### Inline sync
Write to the write store and write to the read store in the same use case `execute()`. If the read store write fails, the data is inconsistent until the next successful write.

```
execute():
  entity = Entity.create(input)
  await writeRepo.save(entity.toDTO())      ← write store (Postgres)
  await readRepo.save(entity.toDTO())       ← read store (MongoDB) — inline
  await cache.set(entity.toDTO())
  await eventBus.publish(...)
```

**Risk**: partial failure between the two writes. Acceptable when eventual catch-up (next write will resync) is tolerable, or when the service has low write volume and the risk is manageable.

---

### Transactional outbox
Write to the write store and an `outbox` table in the **same DB transaction**. A separate background worker polls the outbox and writes to the read store, then marks the row as processed.

```
DB transaction:
  INSERT INTO orders (...)
  INSERT INTO outbox (event_type, payload, processed=false)

Background poller:
  SELECT * FROM outbox WHERE processed = false
  → write to read store (MongoDB)
  → UPDATE outbox SET processed = true
```

**Guarantees**: at-least-once delivery. The read store may lag by seconds/minutes depending on polling frequency. Requires idempotent read model writes.

No event bus required — just a DB table and a poller. Good when you want durability without operational complexity of a message broker.

---

### Event-driven (publish event → consumer updates read model)
Publish an event after the write. A consumer (same service or separate) subscribes and updates the read model.

```
execute():
  await writeRepo.save(entity.toDTO())
  await eventBus.publish('order.created', payload)   ← fire and forget

Consumer (e.g. Kafka, SNS, Kinesis):
  on 'order.created':
    await readRepo.save(payload)
```

**Lag**: depends on event bus and consumer throughput. Reads may return stale data until the consumer processes the event.

The consumer can be the same service's messaging inbound adapter (see `references/adapters-inbound.md`) or a completely separate service. If it lives in the same service, it follows the same inbound adapter pattern — parse, delegate to a use case, skip-and-log on error.

This strategy composes well with the existing architecture: the event bus outbound adapter and Kafka consumer inbound adapter are already defined. No extra infra beyond what you already have if Kafka is in the stack.

---

### CDC (Change Data Capture)
A tool like Debezium reads the database's transaction log (Postgres WAL, MySQL binlog) and streams row-level changes to a message bus. A consumer reads those events and updates the read model.

```
Postgres WAL → Debezium → Kafka topic 'pg.orders' → Consumer → MongoDB
```

**Zero application code change** — the sync happens at the infrastructure level. Good for brownfield migrations or when you cannot change the write path. High operational cost: requires running Debezium (or equivalent), tuning log retention, handling schema evolution.

---

## Clarifying question for Step 0

Add this to the context-gathering step when the user mentions CQRS or separate read/write stores:

> "How should the read model stay in sync with the write model? Options: inline (write to both in the same use case), outbox (same-DB transaction + background poller), event-driven (publish event → consumer updates read model), or CDC (Debezium/log reader at infra level). If unsure, inline is the simplest starting point."
