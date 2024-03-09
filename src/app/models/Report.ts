// import { Models } from 'appwrite';
import { Models } from 'src/app/extras/sdk/src';

export type Report = Models.Document & {
  reason: string;
  to: string;
  sender: string;
};
