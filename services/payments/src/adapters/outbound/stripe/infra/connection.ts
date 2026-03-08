import Stripe from "stripe";

export class StripeConnection {
  private client: Stripe | null = null;

  constructor(
    private readonly stripeSecretKey: string,
  ) {}

  connect(): Stripe {
    if (this.client) return this.client;

    this.client = new Stripe(this.stripeSecretKey, { apiVersion: "2024-06-20" });
    
    return this.client
  }

  getClient(): Stripe {
    if (!this.client) {
      throw new Error("StripeConnection is not connected");
    };
    
    return this.client
  }
}