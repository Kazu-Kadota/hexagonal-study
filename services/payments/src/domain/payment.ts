export const paymentStatus = {
  pending: "pending",
  created: "created",
  cancelled: "cancelled"
} as const;

export type PaymentStatusType = keyof typeof paymentStatus

export const currency = {
  brl: "brl",
  usd: "usd",
  cad: "cad",
  eur: "eur",
} as const;

export type CurrencyType = keyof typeof currency

export type PaymentDomain = {
  id: string;
  idempotency_key: string;
  orderId: string;
  amount: number;
  currency: CurrencyType;
  stripePaymentIntentId: string;
  status: PaymentStatusType;
  createdAt: Date | string;
  updatedAt: Date | string;
};

export type PaymentDTO = PaymentDomain

export type CreatePaymentParams = {
  idempotency: string;
  orderId: string;
  amount: number;
  currency: CurrencyType;
  stripePaymentIntentId: string;
  status: PaymentStatusType;
}

export class Payment {
  private constructor(
    public readonly id: string,
    public idempotency_key: string,
    public readonly orderId: string,
    public amount: number,
    private currency: CurrencyType,
    private stripePaymentIntentId: string,
    private status: PaymentStatusType,
    private readonly createdAt: Date | string,
    private updatedAt: Date | string
  ) {}

  static create(payment: CreatePaymentParams): Payment {
    if (!payment.orderId) throw new Error("Must inform orderId to create Payment")
    if (payment.amount <= 0) throw new Error("Payment amount must be greater than zero")

    return new Payment(
      crypto.randomUUID(),
      payment.idempotency,
      payment.orderId,
      payment.amount,
      payment.currency,
      payment.stripePaymentIntentId,
      paymentStatus.created,
      new Date().toISOString(),
      new Date().toISOString()
    )
  }

  static reconstitute(raw: PaymentDTO): Payment {
    return new Payment(
      raw.id,
      raw.idempotency_key,
      raw.orderId,
      raw.amount,
      raw.currency,
      raw.stripePaymentIntentId,
      raw.status,
      raw.createdAt,
      raw.updatedAt,
    )
  }

  toDTO(): PaymentDTO {
    return {
      amount: this.amount,
      createdAt: this.createdAt,
      currency: this.currency,
      id: this.id,
      idempotency_key: this.idempotency_key,
      orderId: this.orderId,
      status: this.status,
      stripePaymentIntentId: this.stripePaymentIntentId,
      updatedAt: this.updatedAt
    }
  }
}
