import { Message } from 'src/app/models/Message';
import { Room } from 'src/app/models/Room';
import { User } from 'src/app/models/User';
import { tempMessageInterface } from 'src/app/models/types/tempMessage.interface';

export interface RoomExtendedInterface extends Room {
  total: number;
  messages: Message[];
  userData: User;
  tempMessages: tempMessageInterface[] | null;
}
