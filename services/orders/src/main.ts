import { config } from "./infrastructure/config.js";
import { startTelemetry } from "./infrastructure/telemetry.js";
import { bootstrapExpress } from "./adapters/inbound/http/express/bootstrap.js";
import { bootstrapNest } from "./adapters/inbound/http/nest/bootstrap.js";

async function bootstrap() {
  startTelemetry("orders-service", config.otelEndpoint);

  switch (config.framework) {
    case ("express"):
      await bootstrapExpress();
    case ("nest"):
      await bootstrapNest();
  }
}

bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});
