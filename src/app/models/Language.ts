import { Models } from 'appwrite';

export type Language = Models.Document & {
  code: string;
  level: number;
  motherLanguage: boolean;
  name: string;
  nativeName: Date;
  userId: string;
};
