import { RoomExtendedInterface } from 'src/app/models/types/roomExtended.interface';

export interface listRoomsResponseInterface {
  total: number;
  documents: RoomExtendedInterface[];
}
