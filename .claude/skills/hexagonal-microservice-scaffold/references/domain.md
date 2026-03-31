# Domain Layer Template

The domain entity is the heart of the service. It contains pure business logic with **no external dependencies** — no framework, no ORM, no HTTP library.

## Complete annotated template

```ts
// src/domain/<entity>.ts

// Status enum — always use `as const`, never TypeScript `enum`
export const <Entity>Status = {
  pending: "pending",
  active: "active",
  cancelled: "cancelled",
} as const;

export type <Entity>StatusType = keyof typeof <Entity>Status;

// Other value-object enums follow the same pattern
export const currency = {
  brl: "brl",
  usd: "usd",
  cad: "cad",
  eur: "eur",
} as const;

export type CurrencyType = keyof typeof currency;

// The full domain object — used as the transfer object across layer boundaries
export type <Entity>Domain = {
  id: string;
  // ...all fields
  status: <Entity>StatusType;
  createdAt: Date | string;
  updatedAt: Date | string;
};

// DTO = what gets stored, cached, and returned to callers
export type <Entity>DTO = <Entity>Domain;

// Input for the factory method — only what the caller provides (no id, no timestamps)
export type Create<Entity>Params = {
  // e.g. customerId, amount, currency
};

export class <Entity> {
  // Private constructor enforces factory methods — callers can never do `new <Entity>()`
  private constructor(
    public readonly id: string,
    // ...other fields
    private status: <Entity>StatusType,
    private readonly createdAt: Date | string,
    private updatedAt: Date | string,
  ) {}

  // Factory: validates business invariants, generates identity, sets initial state. Logs with technology that users choosed
  static create(params: Create<Entity>Params): <Entity> {
    if (!params.someRequiredField) throw new Error("Must inform someRequiredField to create <Entity>");
    if (params.amount <= 0) throw new Error("<Entity> amount must be greater than zero");

    return new <Entity>(
      crypto.randomUUID(),    // Node 19+ / Web Crypto — no UUID library needed
      // ...fields from params
      <Entity>Status.pending, // initial state is always pending
      new Date().toISOString(),
      new Date().toISOString(),
    );
  }

  // Reconstitute: rebuilds from stored data — NO validation (trust the database)
  static reconstitute(raw: <Entity>DTO): <Entity> {
    return new <Entity>(
      raw.id,
      // ...all fields from raw
      raw.status,
      raw.createdAt,
      raw.updatedAt,
    );
  }

  // State transition: mutates private state, records the time of change
  cancel(): void {
    this.status = <Entity>Status.cancelled;
    this.updatedAt = new Date().toISOString();
  }

  // Add other transitions as needed: activate(), complete(), fail(), etc.

  // Serialize to a plain object — used when crossing layer boundaries (to adapter, to DTO)
  toDTO(): <Entity>DTO {
    return {
      id: this.id,
      // ...all fields
      status: this.status,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
```

## Real example (Orders service)

```ts
// src/domain/order.ts (from the reference implementation)
export const OrderStatus = {
  pending: "pending",
  created: "created",
  cancelled: "cancelled",
} as const;

export type OrderStatusType = keyof typeof OrderStatus;

export const currency = { brl: "brl", usd: "usd", cad: "cad", eur: "eur" } as const;
export type CurrencyType = keyof typeof currency;

export type OrderDomain = {
  id: string;
  customerId: string;
  amount: number;
  currency: CurrencyType;
  status: OrderStatusType;
  createdAt: Date | string;
  updatedAt: Date | string;
};

export type OrderDTO = OrderDomain;

export type OrderCreateDTO = {
  customerId: string;
  amount: number;
  currency: CurrencyType;
};

export class Order {
  private constructor(
    public readonly id: string,
    public readonly customerId: string,
    public amount: number,
    private currency: CurrencyType,
    private status: OrderStatusType,
    private readonly createdAt: Date | string,
    private updatedAt: Date | string,
  ) {}

  static create(orderDto: OrderCreateDTO): Order {
    if (!orderDto.customerId) throw new Error("Must inform customerId to create Order");
    if (orderDto.amount <= 0) throw new Error("Order amount must be greater than zero");
    return new Order(
      crypto.randomUUID(),
      orderDto.customerId,
      orderDto.amount || 0,
      orderDto.currency || "brl",
      OrderStatus.pending,
      new Date().toISOString(),
      new Date().toISOString(),
    );
  }

  static reconstitute(raw: OrderDTO): Order {
    return new Order(raw.id, raw.customerId, raw.amount, raw.currency, raw.status, raw.createdAt, raw.updatedAt);
  }

  cancel(): void {
    this.status = OrderStatus.cancelled;
    this.updatedAt = new Date().toISOString();
  }

  toDTO(): OrderDTO {
    return {
      amount: this.amount,
      createdAt: this.createdAt,
      currency: this.currency,
      customerId: this.customerId,
      id: this.id,
      status: this.status,
      updatedAt: this.updatedAt,
    };
  }
}
```
