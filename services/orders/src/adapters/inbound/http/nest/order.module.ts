import { Module } from '@nestjs/common';
import { OrderController } from './order.controller.js';
import { OrderService } from './order.service.js';
import { EVENT_BUS, KAFKA_CONNECTION, KAFKA_PRODUCER, MONGO_COLLECTION, MONGO_CONNECTION, ORDER_CACHE, ORDER_REPOSITORY, REDIS_CONNECTION, TELEMETRY } from './token.js';
import { Collection } from 'mongodb';
import { Order } from '../../../../domain/order.js';
import { config } from '../../../../infrastructure/config.js';
import { KafkaEventBus } from '../../../outbound/kafka/event-bus.js';
import { OTelTelemetry } from '../../../outbound/telemetry/otel-telemetry.js';
import { MongoOrderRepository } from '../../../outbound/mongodb/order-repository.js';
import { RedisOrderCache } from '../../../outbound/redis/order-cache.js';
import { GetOrderUseCase } from '../../../../application/get-order.js';
import { CreateOrderUseCase } from '../../../../application/create-order.js';
import { CancelOrderUseCase } from '../../../../application/cancel-order.js';
import { DeleteOrderUseCase } from '../../../../application/delete-order.js';
import { MongoConnection } from '../../../outbound/mongodb/infra/connection.js';
import { RedisConnection } from '../../../outbound/redis/infra/connection.js';
import { KafkaConnection } from '../../../outbound/kafka/infra/connection.js';
import { ClientShutdownService } from './infra/client-shutdown.service.js';
import { Producer } from 'kafkajs';

@Module({
  imports: [],
  controllers: [OrderController],
  providers: [
    OrderService,
    ClientShutdownService,
    {
      provide: MONGO_CONNECTION,
      useFactory: async (): Promise<MongoConnection> => {
        const mongo = new MongoConnection(config.mongoUri, config.dbName);
        await mongo.connect();
        return mongo;
      }
    },
    {
      provide: MONGO_COLLECTION,
      useFactory: async (mongo: MongoConnection): Promise<Collection<Order>> => {
        return mongo.getCollection<Order>(config.service);
      },
      inject: [MONGO_CONNECTION]
    },
    {
      provide: REDIS_CONNECTION,
      useFactory: (): RedisConnection => {
        const redis = new RedisConnection(config.redisUrl);
        redis.connect();
        return redis
      }
    },
    {
      provide: KAFKA_CONNECTION,
      useFactory: async (): Promise<KafkaConnection> => {
        const kafka = new KafkaConnection(
          `${config.kafkaClientId}-${config.service}`,
          config.kafkaBrokers
        );
        await kafka.connect();
        return kafka
      }
    },
    {
      provide: KAFKA_PRODUCER,
      useFactory: async (kafkaConnection: KafkaConnection): Promise<Producer> => {
        return await kafkaConnection.producer();
      },
      inject: [KAFKA_CONNECTION]
    },
    {
      provide: EVENT_BUS,
      useFactory: (producer): KafkaEventBus => {
        const eventBus = new KafkaEventBus(producer);
        return eventBus;
      },
      inject: [KAFKA_PRODUCER]
    },
    {
      provide: TELEMETRY,
      useFactory: (): OTelTelemetry => {
        const telemetry = new OTelTelemetry();
        return telemetry;
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
      useFactory: (redisConnection: RedisConnection) => {
        return new RedisOrderCache(redisConnection.getClient());
      },
      inject: [REDIS_CONNECTION]
    },
    {
      provide: GetOrderUseCase,
      useFactory: (
        repository: MongoOrderRepository,
        cache: RedisOrderCache,
        telemetry: OTelTelemetry
      ) => {
        return new GetOrderUseCase(repository, cache, telemetry);
      },
      inject: [ORDER_REPOSITORY, ORDER_CACHE, TELEMETRY]
    },
    {
      provide: CreateOrderUseCase,
      useFactory: (
        repository: MongoOrderRepository,
        cache: RedisOrderCache,
        eventBus: KafkaEventBus,
        telemetry: OTelTelemetry
      ) => {
        return new CreateOrderUseCase(repository, cache, eventBus, telemetry);
      },
      inject: [ORDER_REPOSITORY, ORDER_CACHE, EVENT_BUS, TELEMETRY]
    },
    {
      provide: CancelOrderUseCase,
      useFactory: (
        repository: MongoOrderRepository,
        cache: RedisOrderCache,
        eventBus: KafkaEventBus,
        telemetry: OTelTelemetry
      ) => {
        return new CancelOrderUseCase(repository, cache, eventBus, telemetry);
      },
      inject: [ORDER_REPOSITORY, ORDER_CACHE, EVENT_BUS, TELEMETRY]
    },
    {
      provide: DeleteOrderUseCase,
      useFactory: (
        repository: MongoOrderRepository,
        cache: RedisOrderCache,
        eventBus: KafkaEventBus,
        telemetry: OTelTelemetry
      ) => {
        return new DeleteOrderUseCase(repository, cache, eventBus, telemetry);
      },
      inject: [ORDER_REPOSITORY, ORDER_CACHE, EVENT_BUS, TELEMETRY]
    }
  ],
})
export class OrderModule {}
