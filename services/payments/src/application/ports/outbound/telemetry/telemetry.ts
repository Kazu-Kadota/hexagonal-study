export abstract class IPaymentsTelemetryPort {
  abstract span<T>(name: string, fn: () => Promise<T>): Promise<T>;
}
