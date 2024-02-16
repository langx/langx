import { Models } from 'appwrite';
import { Room } from 'src/app/models/Room';

export interface MessageExtendedInterface extends Models.Document {
  sender: string;
  seen: boolean | false;
  to: string;
  roomId: Room;
  replyTo?: string;
  replyToMessage?: MessageExtendedInterface;
  type: string;
  body?: string;
  image?: URL;
  audio?: URL;
}
