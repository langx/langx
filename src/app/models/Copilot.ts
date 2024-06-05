import { Models } from 'appwrite';

export type Copilot = Models.Document & {
  sender: string;
  correction?: string;
  explanation?: string;
  roomId?: string;
  messageId?: string;
};
