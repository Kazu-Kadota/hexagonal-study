import { NestFactory } from '@nestjs/core';
import { PaymentModule } from './payment.module.js';
import { ValidationPipe } from '@nestjs/common';
import { config } from '../../../../infrastructure/config.js';

export async function bootstrapNest() {
  const app = await NestFactory.create(PaymentModule);

  app.useGlobalPipes(new ValidationPipe());
  app.enableShutdownHooks();
  
  await app.listen(config.port, () => {
    console.log(`${config.service} service on :${config.port}`);
  });
}
