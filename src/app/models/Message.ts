import { Models } from 'appwrite';

export type Message = Models.Document & {
  body?: string;
  sender: string;
  seen: boolean | false;
  to: string;
  roomId: string;
  isImage: boolean;
  image?: URL;
};
