import { Models } from 'appwrite';

// TODO: Implement this
export type Message = Models.Document & {
  body: string;
  seen: boolean;
  sender: string;
  roomId: string;
};
