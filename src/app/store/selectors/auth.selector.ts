import { createFeatureSelector, createSelector } from '@ngrx/store';

import { AuthStateInterface } from 'src/app/models/types/states/authState.interface';

export const authFeatureSelector =
  createFeatureSelector<AuthStateInterface>('auth');

export const isLoadingSelector = createSelector(
  authFeatureSelector,
  (authState: AuthStateInterface) => authState.isLoading
);

export const accountSelector = createSelector(
  authFeatureSelector,
  (authState: AuthStateInterface) => authState.account
);

export const currentUserSelector = createSelector(
  authFeatureSelector,
  (authState: AuthStateInterface) => authState.currentUser
);

export const isLanguageDoneSelector = createSelector(
  authFeatureSelector,
  (authState: AuthStateInterface) => authState.isLanguageDone
);

export const isLoggedInSelector = createSelector(
  authFeatureSelector,
  (authState: AuthStateInterface) => authState.isLoggedIn
);

export const isCompletedRegistrationSelector = createSelector(
  authFeatureSelector,
  (authState: AuthStateInterface) => authState.isCompletedRegistration
);

export const loginValidationErrorSelector = createSelector(
  authFeatureSelector,
  (authState: AuthStateInterface) => authState.loginValidationError
);

export const registerValidationErrorSelector = createSelector(
  authFeatureSelector,
  (authState: AuthStateInterface) => authState.registerValidationError
);

export const unauthorizedErrorSelector = createSelector(
  authFeatureSelector,
  (authState: AuthStateInterface) => authState.unauthorizedError
);

export const profileErrorSelector = createSelector(
  authFeatureSelector,
  (authState: AuthStateInterface) => authState.profileError
);

export const editProfileErrorSelector = createSelector(
  authFeatureSelector,
  (authState: AuthStateInterface) => authState.editProfileError
);

export const totalUnseenSelector = createSelector(
  authFeatureSelector,
  (authState: AuthStateInterface) => authState.currentUser?.totalUnseen
);

export const identitiesSelector = createSelector(
  authFeatureSelector,
  (authState: AuthStateInterface) => authState.identities
);

export const sessionsSelector = createSelector(
  authFeatureSelector,
  (authState: AuthStateInterface) => authState.sessions
);

export const accountDetailErrorSelector = createSelector(
  authFeatureSelector,
  (authState: AuthStateInterface) => authState.accountDetailError
);

export const verifyEmailSuccessSelector = createSelector(
  authFeatureSelector,
  (authState: AuthStateInterface) => authState.verifyEmailSuccess
);

export const verifyEmailConfirmationSuccessSelector = createSelector(
  authFeatureSelector,
  (authState: AuthStateInterface) => authState.verifyEmailConfirmationSuccess
);

export const verifyEmailErrorSelector = createSelector(
  authFeatureSelector,
  (authState: AuthStateInterface) => authState.verifyEmailError
);

export const resetPasswordSuccessSelector = createSelector(
  authFeatureSelector,
  (authState: AuthStateInterface) => authState.resetPasswordSuccess
);

export const resetPasswordConfirmationSuccessSelector = createSelector(
  authFeatureSelector,
  (authState: AuthStateInterface) => authState.resetPasswordConfirmationSuccess
);

export const resetPasswordErrorSelector = createSelector(
  authFeatureSelector,
  (authState: AuthStateInterface) => authState.resetPasswordError
);

export const updatePasswordSuccessSelector = createSelector(
  authFeatureSelector,
  (authState: AuthStateInterface) => authState.updatePasswordSuccess
);

export const updatePasswordErrorSelector = createSelector(
  authFeatureSelector,
  (authState: AuthStateInterface) => authState.updatePasswordError
);

export const blockUserSuccessSelector = createSelector(
  authFeatureSelector,
  (authState: AuthStateInterface) => authState.blockUserSuccess
);

export const blockUserErrorSelector = createSelector(
  authFeatureSelector,
  (authState: AuthStateInterface) => authState.blockUserError
);

export const blockedUsersDataSelector = createSelector(
  authFeatureSelector,
  (authState: AuthStateInterface) => authState.blockedUsersData
);

export const blockedUsersErrorSelector = createSelector(
  authFeatureSelector,
  (authState: AuthStateInterface) => authState.blockedUsersError
);

export const unBlockUserSuccessSelector = createSelector(
  authFeatureSelector,
  (authState: AuthStateInterface) => authState.unBlockUserSuccess
);

export const unBlockUserErrorSelector = createSelector(
  authFeatureSelector,
  (authState: AuthStateInterface) => authState.unBlockUserError
);

export const archiveRoomSuccessSelector = createSelector(
  authFeatureSelector,
  (authState: AuthStateInterface) => authState.archiveRoomSuccess
);

export const archiveRoomErrorSelector = createSelector(
  authFeatureSelector,
  (authState: AuthStateInterface) => authState.archiveRoomError
);
