import { Models } from 'react-native-appwrite';
import { User } from './User';

export type Streak = Models.Document & {
  dayStreak: number;
  userId: string;
};
