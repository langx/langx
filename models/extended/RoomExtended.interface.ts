import { Room } from '@/models/Room';
import { Message } from '@/models/Message';
import { User } from '@/models/User';

export interface RoomExtendedInterface extends Room {
  messages: Message[];
  userData: User;
}
