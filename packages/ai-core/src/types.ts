export type MessageRole = 'system' | 'user' | 'assistant';

export interface Message {
  role: MessageRole;
  content: string;
}

export interface FileOperation {
  path: string;
  content: string;
}

export interface ILLMProvider {
  testConnection(): Promise<boolean>;
  listModels(): Promise<{ id: string; name: string }[]>;
  streamChat(messages: Message[], model: string): ReadableStream<string>;
}