import { Models } from 'react-native-appwrite';
import { User } from './User';

export type Streak = Models.Document & {
  daystreak: number;
  userId: string;
};
