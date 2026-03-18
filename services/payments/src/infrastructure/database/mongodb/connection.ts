import { MongoClient, Db, MongoClientOptions } from "mongodb";
import { RepositoryConnectionPort } from "../ports.js";

export class MongoConnection implements RepositoryConnectionPort {
  private client: MongoClient | null = null;
  private db: Db | null = null;

  constructor(
    private readonly uri: string,
    private readonly dbName: string,
    private readonly mongoOptions?: MongoClientOptions,
  ) {}

  async connect(): Promise<void> {
    if (this.client) return;

    this.client = new MongoClient(this.uri, this.mongoOptions);
    await this.client.connect();
    this.db = this.client.db(this.dbName);
  }

  async isHealthy(): Promise<boolean> {
    if (!this.client) return false;

    try {
      await this.client.db(this.dbName).command({ ping: 1 });
      return true;
    } catch {
      return false;
    }
  }

  async close(): Promise<void> {
    if (!this.client) return;

    await this.client.close();
    this.client = null;
  }

  getClient(): Db {
    if (!this.db) {
      throw new Error("MongoConnection is not connected");
    }

    return this.db;
  }
}