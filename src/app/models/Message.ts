import { Models } from 'appwrite';

export type Message = Models.Document & {
  body: string;
  seen: boolean | false;
  sender: string;
  to: string;
  roomId: string;
};
