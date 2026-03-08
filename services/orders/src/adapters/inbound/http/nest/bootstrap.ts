import { NestFactory } from '@nestjs/core';
import { OrderModule } from './order.module.js';
import { ValidationPipe } from '@nestjs/common';
import { config } from '../../../../infrastructure/config.js';

export async function bootstrapNest() {
  const app = await NestFactory.create(OrderModule);

  app.useGlobalPipes(new ValidationPipe());
  app.enableShutdownHooks();
  
  await app.listen(config.port, () => {
    console.log(`orders service on :${config.port}`);
  });
}
