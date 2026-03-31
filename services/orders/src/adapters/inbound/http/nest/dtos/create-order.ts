import { IsNotEmpty, IsNumber, IsString, IsUUID } from "class-validator";
import { CurrencyType } from "../../../../../entity/order/order.js";

export class CreateOrderBody {
  @IsNotEmpty()
  @IsUUID()
  customerId!: string;

  @IsNotEmpty()
  @IsNumber()
  amount!: number;
  
  @IsNotEmpty()
  @IsString()
  currency!: CurrencyType;
}

export class CreateOrderOutput {
  id!: string;
  customerId!: string;
  amount!: number;
  currency!: string;
  status!: string;
  createdAt!: Date | string;
  updatedAt!: Date | string;
}
