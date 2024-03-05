import { Models } from 'appwrite';
import { Language } from './Language';
import { Streak } from './Streaks';

export type User = Models.Document & {
  name: string;
  country: string;
  countyCode: string;
  gender: string;
  birthdate: Date;
  languageArray?: string[];
  badges?: string[];
  profilePhoto?: URL;
  languages?: Language[];
  otherPhotos?: URL[];
  aboutMe?: string;
  lastSeen?: Date;
  totalUnseen?: number;
  totalUnseenArchived?: number;
  notifications?: string[];
  notificationsArray?: string[];
  blockedUsers?: string[];
  archivedRooms?: string[];
  privacy?: string[];
  contributors?: string[];
  sponsor: boolean;
  streaks: Streak;
};
