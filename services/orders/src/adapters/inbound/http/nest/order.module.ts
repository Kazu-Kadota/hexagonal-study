import { Module } from '@nestjs/common';
import { OrderController } from './order.controller.js';
import { OrderService } from './order.service.js';
import { EVENT_BUS, KAFKA_CONNECTION, KAFKA_PRODUCER, MONGO_READ_COLLECTION, MONGO_READ_CONNECTION, MONGO_WRITE_COLLECTION, MONGO_WRITE_CONNECTION, ORDER_CACHE, POSTGRES_READ_CONNECTION, POSTGRES_WRITE_CONNECTION, POSTGRES_READ_PRISMA_CLIENT, POSTGRES_WRITE_PRISMA_CLIENT, READ_ORDER_REPOSITORY, REDIS_CONNECTION, TELEMETRY, WRITE_ORDER_REPOSITORY } from './token.js';
import { Collection } from 'mongodb';
import { OrderDTO } from '../../../../domain/order.js';
import { config } from '../../../../infrastructure/config.js';
import { KafkaEventBus } from '../../../outbound/messaging/kafka/event-bus.js';
import { OTelTelemetry } from '../../../outbound/telemetry/otel/otel-telemetry.js';
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
import { IOrdersRepositoryWritePort } from '../../../../application/ports/outbound/database/database-write.js';
import { MongoOrderRepositoryWrite } from '../../../outbound/database/mongodb/write.js';
import { IOrdersCachePort } from '../../../../application/ports/outbound/cache/cache.js';
import { IOrdersEventBusPort } from '../../../../application/ports/outbound/messaging/messaging.js';
import { IOrdersTelemetryPort } from '../../../../application/ports/outbound/telemetry/telemetry.js';
import { IOrdersRepositoryReadPort } from '../../../../application/ports/outbound/database/database-read.js';

@Module({
  imports: [],
  controllers: [OrderController],
  providers: [
    OrderService,
    ClientShutdownService,
    {
      provide: POSTGRES_READ_CONNECTION,
      useFactory: async (): Promise<PostgresConnection> => {
        const postgresUrl = `postgresql://${config.database.write.user}:${config.database.write.password}@${config.database.write.host}:${config.database.write.port}/orders`;
        const postgres = new PostgresConnection(postgresUrl);
        if (config.database.read.provider === 'postgres') {
          await postgres.connect();
        }
        return postgres;
      }
    },
    {
      provide: POSTGRES_READ_PRISMA_CLIENT,
      useFactory: async (postgresConnection: PostgresConnection): Promise<PrismaClient | null> => {
        return config.database.read.provider === 'postgres' ? postgresConnection.getClient() : null;
      },
      inject: [POSTGRES_READ_CONNECTION]
    },
    {
      provide: POSTGRES_WRITE_CONNECTION,
      useFactory: async (): Promise<PostgresConnection> => {
        const postgresUrl = `postgresql://${config.database.write.user}:${config.database.write.password}@${config.database.write.host}:${config.database.write.port}/orders`;
        const postgres = new PostgresConnection(postgresUrl);
        if (config.database.write.provider === 'postgres') {
          await postgres.connect();
        }
        return postgres;
      }
    },
    {
      provide: POSTGRES_WRITE_PRISMA_CLIENT,
      useFactory: async (postgresConnection: PostgresConnection): Promise<PrismaClient | null> => {
        return config.database.write.provider === 'postgres' ? postgresConnection.getClient() : null;
      },
      inject: [POSTGRES_WRITE_CONNECTION]
    },
    {
      provide: MONGO_READ_CONNECTION,
      useFactory: async (): Promise<MongoConnection> => {
        const mongo = new MongoConnection(config.database.read.uri, 'orders');
        if (config.database.read.provider === 'mongodb') {
          await mongo.connect();
        }
        return mongo;
      }
    },
    {
      provide: MONGO_READ_COLLECTION,
      useFactory: async (mongoConnection: MongoConnection): Promise<Collection<OrderDTO> | null> => {
        return config.database.read.provider === 'mongodb' ? mongoConnection.getClient().collection<OrderDTO>('orders') : null;
      },
      inject: [MONGO_READ_CONNECTION]
    },
    {
      provide: MONGO_WRITE_CONNECTION,
      useFactory: async (): Promise<MongoConnection> => {
        const mongo = new MongoConnection(config.database.read.uri, 'orders');
        if (config.database.write.provider === 'mongodb') {
          await mongo.connect();
        }
        return mongo;
      }
    },
    {
      provide: MONGO_WRITE_COLLECTION,
      useFactory: async (mongoConnection: MongoConnection): Promise<Collection<OrderDTO> | null> => {
        return config.database.write.provider === 'mongodb' ? mongoConnection.getClient().collection<OrderDTO>('orders') : null;
      },
      inject: [MONGO_WRITE_CONNECTION]
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
      useFactory: (prismaClient: PrismaClient | null, collection: Collection<OrderDTO> | null): IOrdersRepositoryWritePort => {
        if (config.database.write.provider === 'postgres') {
          if (!prismaClient) throw new Error('Postgres write client is not available');
          return new PostgresOrderRepositoryWrite(prismaClient);
        }

        if (!collection) throw new Error('Mongo write collection is not available');
        return new MongoOrderRepositoryWrite(collection);
      },
      inject: [POSTGRES_WRITE_PRISMA_CLIENT, MONGO_WRITE_COLLECTION]
    },
    {
      provide: READ_ORDER_REPOSITORY,
      useFactory: (prismaClient: PrismaClient | null, collection: Collection<OrderDTO> | null): IOrdersRepositoryWritePort => {
        if (config.database.read.provider === 'postgres') {
          if (!prismaClient) throw new Error('Postgres read client is not available');
          return new PostgresOrderRepositoryWrite(prismaClient);
        }

        if (!collection) throw new Error('Mongo read collection is not available');
        return new MongoOrderRepositoryWrite(collection);
      },
      inject: [POSTGRES_READ_PRISMA_CLIENT, MONGO_READ_COLLECTION]
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
        writeRepository: IOrdersRepositoryWritePort,
        cache: IOrdersCachePort,
        eventBus: IOrdersEventBusPort,
        telemetry: IOrdersTelemetryPort
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
        readRepository: IOrdersRepositoryReadPort,
        cache: IOrdersCachePort,
        telemetry: IOrdersTelemetryPort
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
        readRepository: IOrdersRepositoryReadPort,
        writeRepository: IOrdersRepositoryWritePort,
        cache: IOrdersCachePort,
        eventBus: IOrdersEventBusPort,
        telemetry: IOrdersTelemetryPort
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
        writeRepository: IOrdersRepositoryWritePort,
        cache: IOrdersCachePort,
        eventBus: IOrdersEventBusPort,
        telemetry: IOrdersTelemetryPort
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
