// import { Models } from 'appwrite';
import { Models } from 'src/app/extras/sdk/src';

export type Message = Models.Document & {
  sender: string;
  seen: boolean | false;
  to: string;
  roomId: string;
  replyTo?: string;
  type: string;
  body?: string;
  image?: URL;
  audio?: URL;
};
