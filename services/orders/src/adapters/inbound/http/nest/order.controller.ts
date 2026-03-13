import { Body, Controller, Delete, Get, HttpCode, InternalServerErrorException, NotFoundException, Param, Post, Put } from '@nestjs/common';
import { OrderService } from './order.service.js';
import { DeleteOrderParams } from './dtos/delete-order.js';
import { CreateOrderBody, CreateOrderOutput } from './dtos/create-order.js';
import { GetOrderOutput, GetOrderParams } from './dtos/get-order.js';
import { CancelOrderParams } from './dtos/cancel-order.js';
import { IHTTPSPort } from '../../../../application/ports/inbound/http.js';

@Controller()
export class OrderController implements IHTTPSPort{
  constructor(
    private readonly orderService: OrderService
  ) {}

  @Post("order")
  @HttpCode(201)
  async createOrder(@Body() body: CreateOrderBody): Promise<CreateOrderOutput> {
    const order = await this.orderService.createOrder(body);
    return order;
  }

  @Get("order/:id")
  @HttpCode(200)
  async getOrder(@Param() param: GetOrderParams): Promise<GetOrderOutput> {
    try {
      const order = await this.orderService.getOrder(param.id);
      return order;
    } catch (error) {
      if (error instanceof Error && error.message === "Order not found") {
        throw new NotFoundException("Order not found");
      }
      throw new InternalServerErrorException("Internal server error");
    }
  }

  @Put("order/:id/cancel")
  @HttpCode(200)
  async cancelOrder(@Param() param: CancelOrderParams): Promise<void> {
    try {
      const order = await this.orderService.cancelOrder(param.id);
      return order;
    } catch (error) {
      if (error instanceof Error && error.message === "Order not found") {
        throw new NotFoundException("Order not found");
      }
      throw new InternalServerErrorException("Internal server error");
    }
  }

  @Delete("order/:id")
  @HttpCode(204)
  async deleteOrder(@Param() param: DeleteOrderParams): Promise<void> {
    try {
      const order = await this.orderService.deleteOrder(param.id);
      return order;
    } catch (error) {
      if (error instanceof Error && error.message === "Order not found") {
        throw new NotFoundException("Order not found");
      }
      throw new InternalServerErrorException("Internal server error");
    }
  }
}
