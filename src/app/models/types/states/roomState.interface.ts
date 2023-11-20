import { RoomExtendedInterface } from 'src/app/models/types/roomExtended.interface';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';

export interface RoomStateInterface {
  isLoading: boolean;
  total: number;
  totalUnseen: number;
  error: ErrorInterface | null;
  rooms: RoomExtendedInterface[] | null;
}
