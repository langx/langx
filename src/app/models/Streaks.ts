// import { Models } from 'appwrite';
import { Models } from 'src/app/extras/sdk/src';
import { User } from './User';

export type Streak = Models.Document & {
  dayStreak: number;
  userId: User;
};
