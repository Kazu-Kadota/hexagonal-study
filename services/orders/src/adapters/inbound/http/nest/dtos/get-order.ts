import { IsNotEmpty, IsUUID } from "class-validator";

export class GetOrderParams {
  @IsNotEmpty()
  @IsUUID()
  id!: string;
}

export class GetOrderOutput {
  id!: string;
  customerId!: string;
  amount!: number;
  currency!: string;
  status!: string;
  createdAt!: Date | string;
  updatedAt!: Date | string;
}