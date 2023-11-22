import { ErrorInterface } from 'src/app/models/types/errors/error.interface';
import { RoomExtendedInterface } from '../roomExtended.interface';
import { tempMessageInterface } from '../tempMessage.interface';

export interface MessageStateInterface {
  isLoading: boolean;
  isLoading_offset: boolean;
  tempMessages: tempMessageInterface[] | null;
  room: RoomExtendedInterface | null;
  error: ErrorInterface | null;
}
