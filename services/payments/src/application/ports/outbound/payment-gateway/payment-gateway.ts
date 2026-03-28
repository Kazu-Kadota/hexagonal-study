export type PaymentGatewayPortInput = {
  amount: number;
  currency: string;
  metadata: Record<string, string>;
  idempotencyKey: string;
};

export abstract class IPaymentsGatewayPort {
  abstract createPaymentIntent(input: PaymentGatewayPortInput): Promise<{
    id: string,
    status: string,
  }>;
}