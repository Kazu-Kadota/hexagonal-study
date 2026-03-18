import { Module } from '@nestjs/common';
import { PaymentController } from './payment.controller.js';
import { PaymentService } from './payment.service.js';
import { EVENT_BUS, KAFKA_CONNECTION, KAFKA_PRODUCER, MONGO_COLLECTION, MONGO_CONNECTION, PAYMENT_CACHE, PAYMENT_REPOSITORY, REDIS_CONNECTION, TELEMETRY, KAFKA_CONSUMER, STRIPE_CONNECTION, STRIPE_GATEWAY } from './token.js';
import { Collection } from 'mongodb';
import { config } from '../../../../infrastructure/config.js';
import { KafkaEventBus } from '../../../outbound/messaging/kafka/event-bus.js';
import { OTelTelemetry } from '../../../outbound/telemetry/otel/otel-telemetry.js';
import { MongoConnection } from '../../../outbound/mongodb/infra/connection.js';
import { RedisConnection } from '../../../outbound/cache/redis/infra/connection.js';
import { KafkaConnection } from '../../../outbound/messaging/kafka/infra/connection.js';
import { ClientShutdownService } from './infra/client-shutdown.service.js';
import { Consumer, Producer } from 'kafkajs';
import { MongoPaymentRepository } from '../../../outbound/mongodb/payment-repository.js';
import { PaymentDomain } from '../../../../domain/payment.js';
import { StripeConnection } from '../../../outbound/payment-gateway/stripe/infra/connection.js';
import { CreatePaymentUseCase } from '../../../../application/create-payment.js';
import { StripeGateway } from '../../../outbound/payment-gateway/stripe/stripe-gateway.js';
import { GetPaymentUseCase } from '../../../../application/get-payment.js';
import { FindPaymentByIdempotencyUseCase } from '../../../../application/find-payment-by-idempotency.js';
import { RedisPaymentCache } from '../../../outbound/cache/redis/payment-cache.js';

@Module({
  imports: [],
  controllers: [PaymentController],
  providers: [
    PaymentService,
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
      useFactory: async (mongo: MongoConnection): Promise<Collection<PaymentDomain>> => {
        return mongo.getCollection<PaymentDomain>(config.service);
      },
      inject: [MONGO_CONNECTION]
    },
    {
      provide: PAYMENT_REPOSITORY,
      useFactory: (collection: Collection<PaymentDomain>) => {
        return new MongoPaymentRepository(collection);
      },
      inject: [MONGO_COLLECTION]
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
      provide: PAYMENT_CACHE,
      useFactory: (redisConnection: RedisConnection) => {
        return new RedisPaymentCache(redisConnection.getClient());
      },
      inject: [REDIS_CONNECTION]
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
      provide: KAFKA_CONSUMER,
      useFactory: async (kafkaConnection: KafkaConnection): Promise<Consumer> => {
        return await kafkaConnection.consumer('order.created');
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
      provide: STRIPE_CONNECTION,
      useFactory: (): StripeConnection => {
        const stripe = new StripeConnection(config.stripeSecretKey);
        return stripe;
      }
    },
    {
      provide: STRIPE_GATEWAY,
      useFactory: (stripeConnection: StripeConnection): StripeGateway => {
        const stripe = stripeConnection.connect();

        const stripeGateweay = new StripeGateway(stripe)
        return stripeGateweay;
      },
      inject: [STRIPE_CONNECTION]
    },
    {
      provide: CreatePaymentUseCase,
      useFactory: (
        repository: MongoPaymentRepository,
        gateway: StripeGateway,
        eventBus: KafkaEventBus,
        cache: RedisPaymentCache,
        telemetry: OTelTelemetry) => {
        return new CreatePaymentUseCase(repository, gateway, eventBus, cache, telemetry);
      },
      inject: [PAYMENT_REPOSITORY, STRIPE_GATEWAY, PAYMENT_CACHE, EVENT_BUS, TELEMETRY]
    },
    {
      provide: GetPaymentUseCase,
      useFactory: (
        repository: MongoPaymentRepository,
        cache: RedisPaymentCache,
        telemetry: OTelTelemetry
      ) => {
        return new GetPaymentUseCase(repository, cache, telemetry);
      },
      inject: [PAYMENT_REPOSITORY, PAYMENT_CACHE, TELEMETRY]
    },
    {
      provide: FindPaymentByIdempotencyUseCase,
      useFactory: (
        repository: MongoPaymentRepository,
        cache: RedisPaymentCache,
        telemetry: OTelTelemetry
      ) => {
        return new FindPaymentByIdempotencyUseCase(repository, cache, telemetry);
      },
      inject: [PAYMENT_REPOSITORY, PAYMENT_CACHE, TELEMETRY]
    },
  ],
})
export class PaymentModule {}
