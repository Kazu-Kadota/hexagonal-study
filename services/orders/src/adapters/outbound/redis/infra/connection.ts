import { Redis } from "ioredis";

export class RedisConnection {
  private client: Redis | null = null;

  constructor(
    private readonly redisUrl: string,
  ) {}

  connect(): Redis {
    if (this.client) return this.client;

    this.client = new Redis(this.redisUrl);
    
    return this.client
  }

  getClient(): Redis {
    if (!this.client) {
      throw new Error("RedisConnection is not connected");
    };
    
    return this.client
  }

  async close(): Promise<void> {
    if (!this.client) return;

    try {
      await this.client.quit();
    } catch {
      this.client.disconnect();
    }
    this.client = null;
  }
}