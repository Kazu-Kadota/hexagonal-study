export abstract class IOrdersTelemetryPort {
  abstract span<T>(name: string, fn: () => Promise<T>): Promise<T>;
}
