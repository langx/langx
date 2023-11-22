import { Countries } from 'src/app/models/locale/Countries';
import { Languages } from 'src/app/models/locale/Languages';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';

export interface LocaleStateInterface {
  isLoading: boolean;
  countries: Countries | null;
  languages: Languages | null;
  error: ErrorInterface | null;
}
