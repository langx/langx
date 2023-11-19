import { Models } from 'appwrite';
import { Room } from 'src/app/models/Room';

export interface MessageExtendedInterface extends Models.Document {
  body: string;
  seen: boolean | false;
  sender: string;
  to: string;
  roomId: Room;
}
