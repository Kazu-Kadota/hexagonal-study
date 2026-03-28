export abstract class PaymentGatewayConnectionPort {
  abstract connect(): void;
  abstract getClient(): unknown
}