import { Models } from 'appwrite';
import { Message } from './Message';

export type Room = Models.Document & {
  users: string[];
  messages: Message[];
};
