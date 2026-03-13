import { config } from "./infrastructure/config.js";
import { bootstrapExpress } from "./adapters/inbound/http/express/bootstrap.js";
// import { bootstrapNest } from "./adapters/inbound/http/nest/bootstrap.js";
import { TelemetryConnection } from "./infrastructure/telemetry/otel/connection.js";

async function bootstrap() {
  const telemetry = new TelemetryConnection(`${config.app.name}-service`, config.telemetry.otel.endpoint);
  telemetry.start();

  // Choose here which server to start, or start both if you want to run them in parallel
  await bootstrapExpress();
  // await bootstrapNest();
}

bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});
