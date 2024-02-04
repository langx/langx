import { User } from 'src/app/models/User';
import { Report } from 'src/app/models/Report';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';

export interface UserStateInterface {
  isLoading: boolean;
  isLoadingByTargetLanguage: boolean;
  totalByTargetLanguage: number;
  usersByTargetLanguage: User[] | null;
  isLoadingByCompletedProfile: boolean;
  totalByCompletedProfile: number;
  usersByCompletedProfile: User[] | null;
  isLoadingByLastSeen: boolean;
  totalByLastSeen: number;
  usersByLastSeen: User[] | null;
  isLoadingByCreatedAt: boolean;
  totalByCreatedAt: number;
  usersByCreatedAt: User[] | null;
  user: User | null;
  error: ErrorInterface | null;
  report: Report | null;
}
