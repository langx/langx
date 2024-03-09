// import { Models } from 'appwrite';
import { Models } from 'src/app/extras/sdk/src';
import { User } from './User';

export type Visit = Models.Document & {
  from: User;
  to: string;
};
