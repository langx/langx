import { Models } from 'appwrite';

export type Wallet = Models.Document & {
  balance: number;
};
