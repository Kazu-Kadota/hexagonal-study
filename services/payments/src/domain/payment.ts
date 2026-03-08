export type Payment = {
  id: string;
  idempotency: string;
  orderId: string;
  amount: number;
  currency: string;
  stripePaymentIntentId: string;
  status: string;
  createdAt: string;
};

export function createPaymentRecord(props: {
  idempotency: string;
  orderId: string;
  amount: number;
  currency: string;
  stripePaymentIntentId: string;
  status: string;
}): Payment {
  return {
    id: crypto.randomUUID(),
    idempotency: props.idempotency,
    orderId: props.orderId,
    amount: props.amount,
    currency: props.currency,
    stripePaymentIntentId: props.stripePaymentIntentId,
    status: props.status,
    createdAt: new Date().toISOString(),
  };
}
