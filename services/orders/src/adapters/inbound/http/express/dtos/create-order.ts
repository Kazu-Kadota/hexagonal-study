import { CurrencyType } from "../../../../../entity/order/order.js";

export type CreateOrderBody = {
  customerId: string;
  amount: number;
  currency: CurrencyType;
}

export type CreateOrderOutput = {
  id: string;
  customerId: string;
  amount: number;
  currency: CurrencyType;
  status: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}
