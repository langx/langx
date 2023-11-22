import { ErrorInterface } from 'src/app/models/types/errors/error.interface';

export interface LocaleStateInterface {
  isLoading: boolean;
  countries: any[] | null;
  languages: any[] | null;
  error: ErrorInterface | null;
}
