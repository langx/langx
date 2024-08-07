import { Models } from 'react-native-appwrite';

export type Language = Models.Document & {
  code: string;
  level: number;
  motherLanguage: boolean;
  name: string;
  nativeName: string;
  userId: string;
};
