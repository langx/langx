import { ErrorInterface } from 'src/app/models/types/errors/error.interface';
import { RoomExtendedInterface } from 'src/app/models/types/roomExtended.interface';

export interface MessageStateInterface {
  isLoading: boolean;
  isLoading_offset: boolean;
  room: RoomExtendedInterface | null;
  error: ErrorInterface | null;
}
