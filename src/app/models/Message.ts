import { Models } from 'appwrite';

export type Message = Models.Document & {
  sender: string;
  seen: boolean | false;
  to: string;
  roomId: string;
  type: string;
  reply?: string;
  body?: string;
  image?: URL;
  audio?: URL;
};
