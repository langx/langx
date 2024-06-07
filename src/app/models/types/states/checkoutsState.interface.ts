import { Checkout } from 'src/app/models/Checkout';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';

export interface CheckoutsStateInterface {
  isLoading: boolean;
  total: number;
  checkouts: Checkout[] | null;
  error: ErrorInterface | null;
}
