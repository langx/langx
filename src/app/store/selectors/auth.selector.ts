import { createFeatureSelector, createSelector } from '@ngrx/store';

import { AuthStateInterface } from 'src/app/models/types/states/authState.interface';

export const authFeatureSelector =
  createFeatureSelector<AuthStateInterface>('auth');

export const isLoadingSelector = createSelector(
  authFeatureSelector,
  (authState: AuthStateInterface) => authState.isLoading
);

export const validationErrorSelector = createSelector(
  authFeatureSelector,
  (authState: AuthStateInterface) => authState.validationError
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
