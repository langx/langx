import { Models } from 'appwrite';

export type Account = Models.Document & {
  name: string;
  country: string;
  countyCode: string;
  gender: string;
  birthdate: Date;
  languageArray?: string[];
  profilePhoto?: URL;
  otherPhotos?: URL[];
  aboutMe?: string;
  lastSeen?: Date;
};
