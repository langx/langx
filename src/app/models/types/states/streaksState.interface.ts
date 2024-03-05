import { Streak } from 'src/app/models/Streaks';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';

export interface StreaksStateInterface {
  isLoading: boolean;
  total: number;
  streaks: Streak[] | null;
  error: ErrorInterface | null;
}
