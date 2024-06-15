import { Models } from 'appwrite';

import { Account } from 'src/app/models/Account';
import { User } from 'src/app/models/User';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';
import { selectLanguagesInterface } from 'src/app/models/types/selectLanguages.interface';

export interface AuthStateInterface {
  isLoading: boolean;
  account: Account | null;
  currentUser: User | null;
  isLoggedIn: boolean | null;
  isCompletedRegistration: boolean;
  isCompletedLanguage: boolean;
  selectedLanguages: selectLanguagesInterface | null;
  identities: Models.Identity[] | null;
  sessions: Models.Session[] | null;
  verifyEmailSuccess: boolean;
  verifyEmailConfirmationSuccess: boolean;
  verifyEmailError: ErrorInterface | null;
  resetPasswordSuccess: boolean;
  resetPasswordConfirmationSuccess: boolean;
  resetPasswordError: ErrorInterface | null;
  updatePasswordSuccess: boolean;
  updatePasswordError: ErrorInterface | null;
  blockUserSuccess: boolean;
  blockUserError: ErrorInterface | null;
  unBlockUserSuccess: boolean;
  unBlockUserError: ErrorInterface | null;
  blockedUsersData: User[] | null;
  blockedUsersError: ErrorInterface | null;
  archiveRoomSuccess: boolean;
  archiveRoomError: ErrorInterface | null;
  unArchiveRoomSuccess: boolean;
  unArchiveRoomError: ErrorInterface | null;
  unauthorizedError: ErrorInterface | null;
  registerValidationError: ErrorInterface | null;
  loginValidationError: ErrorInterface | null;
  profileError: ErrorInterface | null;
  presenceError: ErrorInterface | null;
  editProfileError: ErrorInterface | null;
  accountDetailError: ErrorInterface | null;
  isLoadingDeleteAccount: boolean;
  deleteAccountError: ErrorInterface | null;
  syncDiscordRoles: string[] | null;
  syncDiscordError: ErrorInterface | null;
}
