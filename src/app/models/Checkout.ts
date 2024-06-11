import { Models } from 'appwrite';

export type Checkout = Models.Document & {
  userId: string;
  amount?: number;
  distribution?: number;
  baseAmount?: number;
  text?: number;
  image?: number;
  audio?: number;
  streak?: number;
  badges?: number;
  onlineMin?: number;
  date?: Date;
  totalAmount?: number;
};
