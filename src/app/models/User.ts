import { Models } from 'appwrite';
import { Language } from './Language';

export type User = Models.Document & {
  name: string;
  country: string;
  countyCode: string;
  gender: string;
  birthdate: Date;
  languageArray?: string[];
  profilePhoto?: URL;
  languages?: Language[];
  otherPhotos?: URL[];
  aboutMe?: string;
  lastSeen?: Date;
  totalUnseen?: number;
};
