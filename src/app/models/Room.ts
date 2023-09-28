import { Models } from 'appwrite';
import { Message } from './Message';

// TODO: Implement this
export type Room = Models.Document & {
  typing: boolean[];
  users: string[];
  messages: Message[];
};
