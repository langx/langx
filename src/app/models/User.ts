import { Models } from 'appwrite';
import { Language } from './Language';
import { Streak } from './Streak';

export type User = Models.Document & {
  name: string;
  country: string;
  countyCode: string;
  gender: string;
  birthdate: Date;
  username: string;
  languageArray?: string[];
  motherLanguages?: string[];
  studyLanguages?: string[];
  languages?: Language[];
  badges?: string[];
  aboutMe?: string;
  lastSeen?: Date;
  totalUnseen?: number;
  notifications?: string[];
  notificationsArray?: string[];
  blockedUsers?: string[];
  privacy?: string[];
  contributors?: string[];
  sponsor?: boolean;
  streaks?: Streak;
  profilePic?: string;
  otherPics?: string[];
};
