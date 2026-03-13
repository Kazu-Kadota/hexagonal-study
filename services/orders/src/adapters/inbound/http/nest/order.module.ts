import { Module } from '@nestjs/common';
import { OrderController } from './order.controller.js';
import { OrderService } from './order.service.js';
import { EVENT_BUS, KAFKA_CONNECTION, KAFKA_PRODUCER, MONGO_COLLECTION, MONGO_CONNECTION, ORDER_CACHE, POSTGRES_CONNECTION, POSTGRESS_PRISMA_CLIENT, READ_ORDER_REPOSITORY, REDIS_CONNECTION, TELEMETRY, WRITE_ORDER_REPOSITORY } from './token.js';
import { Collection } from 'mongodb';
import { Order, OrderDTO } from '../../../../domain/order.js';
import { config } from '../../../../infrastructure/config.js';
import { KafkaEventBus } from '../../../outbound/messaging/kafka/event-bus.js';
import { OTelTelemetry } from '../../../outbound/telemetry/otel/otel-telemetry.js';
import { MongoOrderRepositoryRead } from '../../../outbound/database/mongodb/read.js';
import { RedisOrderCache } from '../../../outbound/cache/redis/order-cache.js';
import { GetOrderUseCase } from '../../../../application/get-order.js';
import { CreateOrderUseCase } from '../../../../application/create-order.js';
import { CancelOrderUseCase } from '../../../../application/cancel-order.js';
import { DeleteOrderUseCase } from '../../../../application/delete-order.js';
import { MongoConnection } from '../../../../infrastructure/database/mongodb/connection.js';
import { RedisConnection } from '../../../../infrastructure/cache/redis/connection.js';
import { KafkaConnection } from '../../../../infrastructure/messaging/kafka/connection.js';
import { ClientShutdownService } from './infrastructure/client-shutdown.service.js';
import { Producer } from 'kafkajs';
import { PostgresConnection } from '../../../../infrastructure/database/postgres/connection.js';
import { PrismaClient } from '../../../../generated/orders/client.js';
import { PostgresOrderRepositoryWrite } from '../../../outbound/database/postgres/write.js';

@Module({
  imports: [],
  controllers: [OrderController],
  providers: [
    OrderService,
    ClientShutdownService,
    {
      provide: POSTGRES_CONNECTION,
      useFactory: async (): Promise<PostgresConnection> => {
        const postgresUrl = `postgresql://${config.database.write.user}:${config.database.write.password}@${config.database.write.host}:${config.database.write.port}/orders`;
        const postgres = new PostgresConnection(postgresUrl);
        await postgres.connect();
        return postgres;
      }
    },
    {
      provide: POSTGRESS_PRISMA_CLIENT,
      useFactory: async (postgresConnection: PostgresConnection): Promise<PrismaClient> => {
        return postgresConnection.getClient();
      },
      inject: [POSTGRES_CONNECTION]
    },
    {
      provide: MONGO_CONNECTION,
      useFactory: async (): Promise<MongoConnection> => {
        const mongo = new MongoConnection(config.database.read.uri, 'orders');
        await mongo.connect();
        return mongo;
      }
    },
    {
      provide: MONGO_COLLECTION,
      useFactory: async (mongoConnection: MongoConnection): Promise<Collection<OrderDTO>> => {
        return mongoConnection.getClient().collection<OrderDTO>('orders');
      },
      inject: [MONGO_CONNECTION]
    },
    {
      provide: REDIS_CONNECTION,
      useFactory: (): RedisConnection => {
        const redis = new RedisConnection(config.cache.redis.url);
        redis.connect();
        return redis
      }
    },
    {
      provide: KAFKA_CONNECTION,
      useFactory: async (): Promise<KafkaConnection> => {
        const kafka = new KafkaConnection(
          `${config.messaging.kafka.clientId}-orders`,
          config.messaging.kafka.brokers
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
      provide: WRITE_ORDER_REPOSITORY,
      useFactory: (prismaClient: PrismaClient) => {
        return new PostgresOrderRepositoryWrite(prismaClient);
      },
      inject: [POSTGRESS_PRISMA_CLIENT]
    },
    {
      provide: READ_ORDER_REPOSITORY,
      useFactory: (collection: Collection<Order>) => {
        return new MongoOrderRepositoryRead(collection);
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
      provide: CreateOrderUseCase,
      useFactory: (
        writeRepository: PostgresOrderRepositoryWrite,
        cache: RedisOrderCache,
        eventBus: KafkaEventBus,
        telemetry: OTelTelemetry
      ) => {
        return new CreateOrderUseCase(
          writeRepository,
          cache,
          eventBus,
          telemetry
        );
      },
      inject: [
        WRITE_ORDER_REPOSITORY,
        ORDER_CACHE,
        EVENT_BUS,
        TELEMETRY
      ]
    },
    {
      provide: GetOrderUseCase,
      useFactory: (
        readRepository: MongoOrderRepositoryRead,
        cache: RedisOrderCache,
        telemetry: OTelTelemetry
      ) => {
        return new GetOrderUseCase(
          readRepository,
          cache,
          telemetry
        );
      },
      inject: [
        READ_ORDER_REPOSITORY,
        ORDER_CACHE,
        TELEMETRY
      ]
    },
    {
      provide: CancelOrderUseCase,
      useFactory: (
        writeRepository: PostgresOrderRepositoryWrite,
        readRepository: MongoOrderRepositoryRead,
        cache: RedisOrderCache,
        eventBus: KafkaEventBus,
        telemetry: OTelTelemetry
      ) => {
        return new CancelOrderUseCase(
          readRepository,
          writeRepository,
          cache,
          eventBus,
          telemetry
        );
      },
      inject: [
        WRITE_ORDER_REPOSITORY,
        READ_ORDER_REPOSITORY,
        ORDER_CACHE,
        EVENT_BUS,
        TELEMETRY
      ]
    },
    {
      provide: DeleteOrderUseCase,
      useFactory: (
        writeRepository: PostgresOrderRepositoryWrite,
        cache: RedisOrderCache,
        eventBus: KafkaEventBus,
        telemetry: OTelTelemetry
      ) => {
        return new DeleteOrderUseCase(
          writeRepository,
          cache,
          eventBus,
          telemetry
        );
      },
      inject: [
        WRITE_ORDER_REPOSITORY,
        ORDER_CACHE,
        EVENT_BUS,
        TELEMETRY
      ]
    }
  ],
})
export class OrderModule {}
