import { RoomExtendedInterface } from 'src/app/models/types/roomExtended.interface';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';

export interface RoomStateInterface {
  isLoading: boolean;
  rooms: RoomExtendedInterface[] | null;
  total: number;
  archivedRooms: RoomExtendedInterface[] | null;
  archivedTotal: number;
  error: ErrorInterface | null;
  createRoomError: ErrorInterface | null;
}
