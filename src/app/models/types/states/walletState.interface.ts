import { Wallet } from 'src/app/models/Wallet';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';

export interface WalletStateInterface {
  isLoading: boolean;
  wallet: Wallet | null;
  error: ErrorInterface | null;
}
