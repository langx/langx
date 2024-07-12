import { Models } from 'react-native-appwrite';
import { User } from './User';

export type Visit = Models.Document & {
  from: User;
  to: string;
};
