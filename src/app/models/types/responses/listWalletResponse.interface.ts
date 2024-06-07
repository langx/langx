import { Wallet } from 'src/app/models/Wallet';

export interface listWalletResponseInterface {
  total: number;
  documents: Wallet[];
}
