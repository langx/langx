// import { Models } from 'appwrite';
import { Models } from 'src/app/extras/sdk/src';

export type Language = Models.Document & {
  code: string;
  level: number;
  motherLanguage: boolean;
  name: string;
  nativeName: string;
  userId: string;
};
