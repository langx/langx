import { Models } from 'appwrite';

export type Room = Models.Document & {
  users: string[];
  copilot: string[];
  typing: Date[];
  unseen: number[];
  archived: string[];
  lastMessageUpdatedAt: Date;
};
