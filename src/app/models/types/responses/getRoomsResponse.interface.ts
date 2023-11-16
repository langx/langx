import { RoomExtendedInterface } from 'src/app/models/types/roomExtended.interface';

export interface getRoomsResponseInterface {
  total: number;
  documents: RoomExtendedInterface[];
}
