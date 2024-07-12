import { Models } from 'react-native-appwrite';

export type Report = Models.Document & {
  reason: string;
  to: string;
  sender: string;
};
