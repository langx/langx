import { Models } from 'appwrite';
import { Room } from 'src/app/models/Room';

export interface MessageExtendedInterface extends Models.Document {
  sender: string;
  seen: boolean | false;
  to: string;
  roomId: Room;
  isText: boolean;
  body?: string;
  isImage: boolean;
  image?: URL;
  isAudio: boolean;
  audio?: URL;
}
