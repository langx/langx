import { createFeatureSelector, createSelector } from '@ngrx/store';

import { AuthStateInterface } from '../models/types/states/authState.interface';

export const authFeatureSelector =
  createFeatureSelector<AuthStateInterface>('auth');

export const isLoadingSelector = createSelector(
  authFeatureSelector,
  (authState: AuthStateInterface) => authState.isLoading
);
