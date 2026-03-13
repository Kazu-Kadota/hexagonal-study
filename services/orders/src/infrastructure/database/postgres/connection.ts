import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../../generated/orders/client.js";
import { RepositoryConnectionPort } from "../ports.js";

export class PostgresConnection implements RepositoryConnectionPort {
  private client: PrismaClient | null = null;

  constructor(
    private readonly url: string,
  ) {}

  async connect(): Promise<void> {
    if (this.client) return;

    const adapter = new PrismaPg({
      connectionString: this.url,
    })

    this.client = new PrismaClient({ adapter });
    await this.client.$connect();
  }

  async isHealthy(): Promise<boolean> {
    if (!this.client) return false;

    try {
      await this.client.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  async close(): Promise<void> {
    if (!this.client) return;

    await this.client.$disconnect();
    this.client = null;
  }

  getClient(): PrismaClient {
    if (!this.client) {
      throw new Error("PostgresConnection is not connected");
    }

    return this.client;
  }
}