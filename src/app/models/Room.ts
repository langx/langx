import { Models } from 'appwrite';
import { Message } from './Message';
import { User } from './User';

export type Room = Models.Document & {
  users: string[];
};

export type RoomWithUserData = Room & {
  userData: User;
  lastMessage: Message;
};
