import { Models } from 'appwrite';

export type Report = Models.Document & {
  reason: string;
  to: string;
  sender: string;
};
