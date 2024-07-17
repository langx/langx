import { Models } from 'react-native-appwrite';

export type Jwt = Models.Jwt & {
  expirationDate: Date;
};
