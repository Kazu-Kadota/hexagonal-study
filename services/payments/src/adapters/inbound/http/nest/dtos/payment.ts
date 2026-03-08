import { IsNotEmpty, IsNumber, IsString, IsUUID } from "class-validator";

export class CreatePaymentDto {
  @IsNotEmpty()
  @IsString()
  orderId!: string;

  @IsNotEmpty()
  @IsNumber()
  amount!: number;
  
  @IsNotEmpty()
  @IsString()
  currency!: string;

  @IsNotEmpty()
  @IsString()
  idempotencyKey!: string;
}

export class GetPaymentDto {
  @IsNotEmpty()
  @IsUUID()
  id!: string;
}

export class GetPaymentOutputDto {
  id!: string;
  idempotency!: string;
  orderId!: string;
  amount!: number;
  currency!: string;
  stripePaymentIntentId!: string;
  status!: string;
  createdAt!: string;
}