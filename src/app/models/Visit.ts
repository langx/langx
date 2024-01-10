import { Models } from 'appwrite';

export type Visit = Models.Document & {
  visitor: string;
  to: string;
};
