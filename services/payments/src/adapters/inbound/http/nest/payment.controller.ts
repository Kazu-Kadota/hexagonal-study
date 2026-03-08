import { Body, Controller, Get, HttpCode, InternalServerErrorException, NotFoundException, Param, Post } from '@nestjs/common';
import { PaymentService } from './payment.service.js';
import { PaymentMapper } from './dtos/payment-mapper.js';
import { CreatePaymentDto, GetPaymentDto, GetPaymentOutputDto } from './dtos/payment.js';

@Controller()
export class PaymentController {
  constructor(
    private readonly paymentService: PaymentService
  ) {}

  @Post("payment")
  @HttpCode(201)
  async createPayment(@Body() body: CreatePaymentDto): Promise<GetPaymentOutputDto> {
    const payment = await this.paymentService.createPayment(body);
    const output = PaymentMapper.toGetPaymentOutputDto(payment);
    return output;
  }

  @Get("payment/:id")
  @HttpCode(200)
  async getPayment(@Param() param: GetPaymentDto): Promise<GetPaymentOutputDto> {
    try {
      const payment = await this.paymentService.getPayment(param.id);
  
      const output = PaymentMapper.toGetPaymentOutputDto(payment);
      return output;
    } catch (error) {
      if (error instanceof Error && (error.cause as { status?: number })?.status === 404) {
        throw new NotFoundException("Payment not found");
      }
      throw new InternalServerErrorException("An error occurred while fetching the payment");
    }
  }
}
