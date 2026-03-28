import { PaymentGatewayConnectionPort } from "../ports.js";
import Stripe from "stripe"

export class StripeConnection implements PaymentGatewayConnectionPort {
  private client: Stripe | null = null;

  constructor(
    private readonly stripeSecretKey: string,
  ) {}

  async connect(): Promise<void> {
    if (this.client) return;

    this.client = new Stripe(this.stripeSecretKey, { apiVersion: "2024-06-20" });
  }

  getClient(): Stripe {
    if (!this.client) {
      throw new Error("StripeConnection is not connected");
    };
    
    return this.client
  }
}