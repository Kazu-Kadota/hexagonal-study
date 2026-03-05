export type Payment = {
  id: string;
  orderId: string;
  amount: number;
  currency: string;
  stripePaymentIntentId: string;
  status: string;
  createdAt: string;
};

export function createPaymentRecord(props: {
  orderId: string;
  amount: number;
  currency: string;
  stripePaymentIntentId: string;
  status: string;
}): Payment {
  return {
    id: crypto.randomUUID(),
    orderId: props.orderId,
    amount: props.amount,
    currency: props.currency,
    stripePaymentIntentId: props.stripePaymentIntentId,
    status: props.status,
    createdAt: new Date().toISOString(),
  };
}
