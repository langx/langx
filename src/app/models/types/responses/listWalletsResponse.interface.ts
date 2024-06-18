import { Wallet } from '../../Wallet';

export interface listWalletsResponseInterface {
  total: number;
  documents: Wallet[];
}
