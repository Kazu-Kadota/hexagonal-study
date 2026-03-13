export type GetOrderParams = {
  id: string;
}

export type GetOrderOutput = {
  id: string;
  customerId: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}