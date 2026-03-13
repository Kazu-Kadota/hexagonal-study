import { IsNotEmpty, IsUUID } from "class-validator";

export class CancelOrderParams {
  @IsNotEmpty()
  @IsUUID()
  id!: string;
}