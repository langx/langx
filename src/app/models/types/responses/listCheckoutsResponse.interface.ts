import { Checkout } from 'src/app/models/Checkout';

export interface listCheckoutsResponseInterface {
  total: number;
  documents: Checkout[];
}
