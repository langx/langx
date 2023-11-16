import { RoomExtendedInterface } from 'src/app/models/types/roomExtended.interface';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';

export interface RoomsStateInterface {
  isLoading: boolean;
  total: number;
  error: ErrorInterface | null;
  rooms: RoomExtendedInterface[] | null;
  activeRoom: RoomExtendedInterface | null;
}
