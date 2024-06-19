import { Models } from 'appwrite';

export type Room = Models.Document & {
  users: string[];
  copilot: string[];
  typing: boolean[];
  unseen: number[];
};
