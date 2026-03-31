export const OrderStatus = {
  pending: "pending",
  created: "created",
  cancelled: "cancelled"
} as const;

export type OrderStatusType = keyof typeof OrderStatus

export const currency = {
  brl: "brl",
  usd: "usd",
  cad: "cad",
  eur: "eur",
} as const;

export type CurrencyType = keyof typeof currency

export type OrderDomain = {
  id: string;
  customerId: string;
  amount: number;
  currency: CurrencyType;
  status: OrderStatusType;
  createdAt: Date | string;
  updatedAt: Date | string;
};

export type OrderDTO = OrderDomain

export type OrderCreateDTO = {
  customerId: string;
  amount: number;
  currency: CurrencyType;
}

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
    if (!orderDto.customerId) throw new Error("Must inform customerId to create Order")
    if (orderDto.amount <= 0) throw new Error("Order amount must be greater than zero")

    return new Order(
      crypto.randomUUID(),
      orderDto.customerId,
      orderDto.amount || 0,
      orderDto.currency || 'brl',
      OrderStatus.pending,
      new Date().toISOString(),
      new Date().toISOString()
    )
  }
  
  static reconstitute(raw: OrderDTO): Order {
    return new Order(
      raw.id,
      raw.customerId,
      raw.amount,
      raw.currency,
      raw.status,
      raw.createdAt,
      raw.updatedAt
    )
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
    }
  }
}
