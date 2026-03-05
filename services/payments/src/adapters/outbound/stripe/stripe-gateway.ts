import Stripe from "stripe";
import type { PaymentGatewayPort } from "../../../application/ports.js";

export class StripeGateway implements PaymentGatewayPort {
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
