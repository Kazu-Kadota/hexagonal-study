import Stripe from "stripe";
import { IPaymentsGatewayPort } from "../../../../application/ports/outbound/payment-gateway/payment-gateway.js";

export class StripeGateway implements IPaymentsGatewayPort {
  constructor(private readonly stripe: Stripe) {}

  async createPaymentIntent(input: {
    amount: number;
    currency: string;
    metadata: Record<string, string>;
  }): Promise<{ id: string; status: string }> {
    const intent = await this.stripe.paymentIntents.create({
      amount: input.amount,
      currency: input.currency,
      metadata: input.metadata,
      automatic_payment_methods: { enabled: true },
    });

    return { id: intent.id, status: intent.status };
  }
}
