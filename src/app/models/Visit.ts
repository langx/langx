import { Models } from 'appwrite';

export type Visit = Models.Document & {
  from: string;
  to: string;
};
