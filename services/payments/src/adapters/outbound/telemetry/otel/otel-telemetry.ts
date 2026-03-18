import { trace } from "@opentelemetry/api";
import { IPaymentsTelemetryPort } from "../../../../application/ports/outbound/telemetry/telemetry.js";

export class OTelTelemetry implements IPaymentsTelemetryPort {
  async span<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const tracer = trace.getTracer("payments-service");
    return tracer.startActiveSpan(name, async (span) => {
      try {
        const result = await fn();
        span.end();
        return result;
      } catch (error) {
        span.recordException(error as Error);
        span.end();
        throw error;
      }
    });
  }
}
