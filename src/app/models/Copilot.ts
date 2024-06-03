import { Models } from 'appwrite';

export type Copilot = Models.Document & {
  sender: string;
  correction?: string;
  explanation?: string;
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  totalTokenCount?: number;
  roomId?: string;
  messageId?: string;
};
