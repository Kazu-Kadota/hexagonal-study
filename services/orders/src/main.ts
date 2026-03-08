import { config } from "./infrastructure/config.js";
import { bootstrapExpress } from "./adapters/inbound/http/express/bootstrap.js";
import { bootstrapNest } from "./adapters/inbound/http/nest/bootstrap.js";
import { TelemetryConnection } from "./adapters/outbound/telemetry/infra/connection.js";

async function bootstrap() {
  const telemetry = new TelemetryConnection(`${config.service}-service`, config.otelEndpoint);
  telemetry.start();

  switch (config.framework) {
    case ("express"):
      await bootstrapExpress();
      break;
    case ("nest"):
      await bootstrapNest();
      break;
    default:
      throw new Error("Invalid framework");
  }
}

bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});
