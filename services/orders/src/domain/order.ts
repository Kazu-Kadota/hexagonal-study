export type OrderStatus = "CREATED" | "CANCELLED";

export type Order = {
  id: string;
  customerId: string;
  amount: number;
  currency: string;
  status: OrderStatus;
  createdAt: string;
};

export function createOrder(props: {
  customerId: string;
  amount: number;
  currency: string;
}): Order {
  if (props.amount <= 0) {
    throw new Error("Order amount must be greater than zero.");
  }

  return {
    id: crypto.randomUUID(),
    customerId: props.customerId,
    amount: props.amount,
    currency: props.currency,
    status: "CREATED",
    createdAt: new Date().toISOString(),
  };
}
