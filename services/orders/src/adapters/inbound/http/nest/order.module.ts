import { Module } from '@nestjs/common';
import { OrderController } from './order.controller.js';
import { OrderService } from './order.service.js';
import { EVENT_BUS, KAFKA_PRODUCER, MONGO_COLLECTION, ORDER_CACHE, ORDER_REPOSITORY, REDIS_CLIENT, TELEMETRY } from './token.js';
import { Collection, MongoClient } from 'mongodb';
import { Order } from '../../../../domain/order.js';
import { config } from '../../../../infrastructure/config.js';
import { Redis } from 'ioredis';
import { Kafka, Producer } from 'kafkajs';
import { KafkaEventBus } from '../../../outbound/kafka/event-bus.js';
import { OTelTelemetry } from '../../../outbound/telemetry/otel-telemetry.js';
import { MongoOrderRepository } from '../../../outbound/mongodb/order-repository.js';
import { RedisOrderCache } from '../../../outbound/redis/order-cache.js';
import { GetOrderUseCase } from '../../../../application/get-order.js';
import { CreateOrderUseCase } from '../../../../application/create-order.js';
import { CancelOrderUseCase } from '../../../../application/cancel-order.js';
import { DeleteOrderUseCase } from '../../../../application/delete-order.js';



@Module({
  imports: [],
  controllers: [OrderController],
  providers: [
    OrderService,
    {
      provide: MONGO_COLLECTION,
      useFactory: async (): Promise<Collection<Order>> => {
        const mongo = new MongoClient(config.mongoUri);
        await mongo.connect()
        return mongo.db(config.dbName).collection<Order>("orders");
      }
    },
    {
      provide: REDIS_CLIENT,
      useFactory: (): Redis => {
        const redis = new Redis(config.redisUrl);
        return redis
      }
    },
    {
      provide: KAFKA_PRODUCER,
      useFactory: async (): Promise<Producer> => {
        const kafka = new Kafka({
          clientId: `${config.kafkaClientId}-orders`,
          brokers: config.kafkaBrokers,
        });
        const producer = kafka.producer();
        await producer.connect();
        return producer
      }
    },
    {
      provide: EVENT_BUS,
      useFactory: (producer): KafkaEventBus => {
        const eventBus = new KafkaEventBus(producer);
        return eventBus
      },
      inject: [KAFKA_PRODUCER]
    },
    {
      provide: TELEMETRY,
      useFactory: (): OTelTelemetry => {
        const telemetry = new OTelTelemetry();
        return telemetry
      }
    },
    {
      provide: ORDER_REPOSITORY,
      useFactory: (collection: Collection<Order>) => {
        return new MongoOrderRepository(collection);
      },
      inject: [MONGO_COLLECTION]
    },
    {
      provide: ORDER_CACHE,
      useFactory: (redis: Redis) => {
        return new RedisOrderCache(redis);
      },
      inject: [REDIS_CLIENT]
    },
    {
      provide: GetOrderUseCase,
      useFactory: (repository, cache, telemetry) => {
        return new GetOrderUseCase(repository, cache, telemetry);
      },
      inject: [ORDER_REPOSITORY, REDIS_CLIENT, TELEMETRY]
    },
    {
      provide: CreateOrderUseCase,
      useFactory: (repository, cache, eventBus, telemetry) => {
        return new CreateOrderUseCase(repository, cache, eventBus, telemetry);
      },
      inject: [ORDER_REPOSITORY, REDIS_CLIENT, EVENT_BUS, TELEMETRY]
    },
    {
      provide: CancelOrderUseCase,
      useFactory: (repository, cache, eventBus, telemetry) => {
        return new CancelOrderUseCase(repository, cache, eventBus, telemetry);
      },
      inject: [ORDER_REPOSITORY, REDIS_CLIENT, EVENT_BUS, TELEMETRY]
    },
    {
      provide: DeleteOrderUseCase,
      useFactory: (repository, cache, eventBus, telemetry) => {
        return new DeleteOrderUseCase(repository, cache, eventBus, telemetry);
      },
      inject: [ORDER_REPOSITORY, REDIS_CLIENT, EVENT_BUS, TELEMETRY]
    }
  ],
})
export class OrderModule {}
