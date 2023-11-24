import { Models } from 'appwrite';
import { Room } from 'src/app/models/Room';

export interface MessageExtendedInterface extends Models.Document {
  body?: string;
  sender: string;
  seen: boolean | false;
  to: string;
  isImage: boolean;
  image?: URL;
  roomId: Room;
}
