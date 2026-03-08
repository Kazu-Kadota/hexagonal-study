import { MongoClient, Db, Collection, Document, MongoClientOptions } from "mongodb";

export class MongoConnection {
  private client: MongoClient | null = null;

  constructor(
    private readonly uri: string,
    private readonly dbName: string,
    private readonly mongoOptions?: MongoClientOptions,
  ) {}

  async connect(): Promise<void> {
    if (this.client) return;

    this.client = new MongoClient(this.uri, this.mongoOptions);
    await this.client.connect();
  }

  getDb(): Db {
    if (!this.client) {
      throw new Error("MongoConnection is not connected");
    }

    return this.client.db(this.dbName);
  }

  getCollection<T extends Document>(name: string): Collection<T> {
    return this.getDb().collection<T>(name);
  }

  isHealthy(): boolean {
    if (!this.client) return false;

    try {
      this.client.db(this.dbName).command({ ping: 1 });
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
}