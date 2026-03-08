import { IsNotEmpty, IsNumber, IsString, IsUUID } from "class-validator";

export class CreateOrderDto {
  @IsNotEmpty()
  @IsString()
  customerId!: string;

  @IsNotEmpty()
  @IsNumber()
  amount!: number;
  
  @IsNotEmpty()
  @IsString()
  currency!: string;
}

export class GetOrderDto {
  @IsNotEmpty()
  @IsUUID()
  id!: string;
}

export class GetOrderOutputDto {
  id!: string;
  customerId!: string;
  amount!: number;
  currency!: string;
  status!: string;
  createdAt!: string;
}

export class CancelOrderDto {
  @IsNotEmpty()
  @IsUUID()
  id!: string;
}

export class DeleteOrderDto {
  @IsNotEmpty()
  @IsUUID()
  id!: string;
}