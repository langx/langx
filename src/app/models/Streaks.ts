import { Models } from 'appwrite';
import { User } from './User';

export type Streak = Models.Document & {
  dayStreak: number;
  userId: User;
};
