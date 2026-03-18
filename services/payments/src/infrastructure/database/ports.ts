export abstract class RepositoryConnectionPort {
  abstract connect(): Promise<void>;
  abstract isHealthy(): Promise<boolean>;
  abstract close(): Promise<void>;
  abstract getClient(): unknown;
}