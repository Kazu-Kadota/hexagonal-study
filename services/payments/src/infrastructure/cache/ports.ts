export abstract class CacheConnectionPort {
  abstract connect(): unknown;
  abstract close(): Promise<void>;
  abstract getClient(): unknown;
}