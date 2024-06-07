import { createFeatureSelector, createSelector } from '@ngrx/store';

import { CheckoutsStateInterface } from 'src/app/models/types/states/checkoutsState.interface';

export const checkoutsFeatureSelector =
  createFeatureSelector<CheckoutsStateInterface>('checkout');

export const isLoadingSelector = createSelector(
  checkoutsFeatureSelector,
  (checkoutsState: CheckoutsStateInterface) => checkoutsState.isLoading
);
export const streaksSelector = createSelector(
  checkoutsFeatureSelector,
  (checkoutsState: CheckoutsStateInterface) => checkoutsState.checkouts
);

export const totalSelector = createSelector(
  checkoutsFeatureSelector,
  (checkoutsState: CheckoutsStateInterface) => checkoutsState.total
);

export const errorSelector = createSelector(
  checkoutsFeatureSelector,
  (checkoutsState: CheckoutsStateInterface) => checkoutsState.error
);
