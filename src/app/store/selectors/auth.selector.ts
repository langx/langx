import { createFeatureSelector, createSelector } from '@ngrx/store';

import { AuthStateInterface } from 'src/app/models/types/states/authState.interface';

export const authFeatureSelector =
  createFeatureSelector<AuthStateInterface>('auth');

export const isLoadingSelector = createSelector(
  authFeatureSelector,
  (authState: AuthStateInterface) => authState.isLoading
);

export const registerValidationErrorSelector = createSelector(
  authFeatureSelector,
  (authState: AuthStateInterface) => authState.registerValidationError
);

export const unauthorizedErrorSelector = createSelector(
  authFeatureSelector,
  (authState: AuthStateInterface) => authState.unauthorizedError
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
