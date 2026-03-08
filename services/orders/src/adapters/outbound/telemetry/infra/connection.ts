import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { Resource } from "@opentelemetry/resources";
import { BasicTracerProvider, BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";

export class TelemetryConnection {
  constructor(
    private readonly serviceName: string,
    private readonly endpoint: string,
  ) {}

  start () {
    const provider = new BasicTracerProvider({
      resource: new Resource({ "service.name": this.serviceName }),
      spanProcessors: [new BatchSpanProcessor(new OTLPTraceExporter({ url: `${this.endpoint}/v1/traces` }))],
    });
    provider.register();
  }
}