import { Visit } from 'src/app/models/Visit';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';

export interface VisitsStateInterface {
  isLoading: boolean;
  total: number;
  visits: Visit[] | null;
  error: ErrorInterface | null;
}
