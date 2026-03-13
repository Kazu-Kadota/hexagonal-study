import { IsNotEmpty, IsUUID } from "class-validator";

export class DeleteOrderParams {
  @IsNotEmpty()
  @IsUUID()
  id!: string;
}