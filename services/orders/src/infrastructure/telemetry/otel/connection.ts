import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { Resource } from "@opentelemetry/resources";
import { BasicTracerProvider, BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { TelemtryConnectionPort } from "./ports.js";

export class TelemetryConnection implements TelemtryConnectionPort {
  constructor(
    private readonly serviceName: string,
    private readonly endpoint: string,
  ) {}

  start(): void {
    const provider = new BasicTracerProvider({
      resource: new Resource({ "service.name": this.serviceName }),
      spanProcessors: [new BatchSpanProcessor(new OTLPTraceExporter({ url: `${this.endpoint}/v1/traces` }))],
    });
    provider.register();
  }
}