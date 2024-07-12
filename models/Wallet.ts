import { Models } from 'react-native-appwrite';

export type Wallet = Models.Document & {
  balance: number;
};
