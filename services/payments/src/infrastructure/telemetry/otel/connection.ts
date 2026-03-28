import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { BasicTracerProvider, BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { TelemetryConnectionPort } from "../ports.js";
import { ATTR_SERVICE_NAME, ATTR_SERVICE_NAMESPACE, ATTR_SERVICE_VERSION } from "@opentelemetry/semantic-conventions";
import { trace } from "@opentelemetry/api";

export class TelemetryConnection implements TelemetryConnectionPort {
  constructor(
    private readonly serviceName: string,
    private readonly endpoint: string,
  ) {}

  start(): void {
    const resource = resourceFromAttributes({
      [ATTR_SERVICE_NAME]: this.serviceName,
      [ATTR_SERVICE_VERSION]: '1.0.0',
      [ATTR_SERVICE_NAMESPACE]: this.serviceName
    })

    
    const provider = new BasicTracerProvider({
      resource,
      spanProcessors: [new BatchSpanProcessor(new OTLPTraceExporter({ url: `${this.endpoint}/v1/traces` }))],
    });

    trace.setGlobalTracerProvider(provider)
  }
}