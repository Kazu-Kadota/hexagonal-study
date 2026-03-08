import { Body, Controller, Delete, Get, HttpCode, InternalServerErrorException, NotFoundException, Param, Post, Put } from '@nestjs/common';
import { OrderService } from './order.service.js';
import { CancelOrderDto, CreateOrderDto, DeleteOrderDto, GetOrderDto, GetOrderOutputDto } from './dtos/order.js';
import { OrderMapper } from './dtos/order-mapper.js';

@Controller()
export class OrderController {
  constructor(
    private readonly orderService: OrderService
  ) {}

  @Post("orders")
  @HttpCode(201)
  async createOrder(@Body() body: CreateOrderDto): Promise<void> {
    await this.orderService.createOrder(body);
  }

  @Get("orders/:id")
  @HttpCode(200)
  async getOrder(@Param() param: GetOrderDto): Promise<GetOrderOutputDto> {
    const order = await this.orderService.getOrder(param.id);
    if (!order) {
      throw new NotFoundException("Order not found");
    }

    const output = OrderMapper.toGetOrderOutputDto(order);

    return output;
  }

  @Put("orders/:id/cancel")
  @HttpCode(200)
  async cancelOrder(@Param() param: CancelOrderDto): Promise<void> {
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

  @Delete("orders/:id")
  @HttpCode(200)
  async deleteOrder(@Param() param: DeleteOrderDto): Promise<void> {
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
