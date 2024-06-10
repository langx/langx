import { FilterDataInterface } from '../filterData.interface';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';

export interface FiltersStateInterface {
  filterData: FilterDataInterface | null;
}
