// import { Models } from 'appwrite';
import { Models } from 'src/app/extras/sdk/src';

export type Room = Models.Document & {
  users: string[];
};
