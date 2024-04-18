import { Models } from 'appwrite';

export type Message = Models.Document & {
  sender: string;
  seen: boolean | false;
  to: string;
  roomId: string;
  replyTo?: string;
  type: string;
  body?: string;
  deleted?: boolean | false;
  imageId?: string;
  audioId?: string;
};
