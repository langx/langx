import { Models } from 'appwrite';

export type Message = Models.Document & {
  sender: string;
  seen: boolean | false;
  to: string;
  roomId: string;
  isText: boolean;
  body?: string;
  isImage: boolean;
  image?: URL;
  isAudio: boolean;
  audio?: URL;
};
