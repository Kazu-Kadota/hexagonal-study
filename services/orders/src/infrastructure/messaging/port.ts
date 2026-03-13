export abstract class MessagingConnectionPort {
  abstract connect(): Promise<unknown>;
  abstract close(): Promise<void>;
  abstract getClient(): unknown;
  abstract producer(): Promise<unknown>;
  abstract consumer(name: string): Promise<unknown>;
}