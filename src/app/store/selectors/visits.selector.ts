import { createFeatureSelector, createSelector } from '@ngrx/store';

import { VisitsStateInterface } from 'src/app/models/types/states/visitsState.interface';

export const visitsFeatureSelector =
  createFeatureSelector<VisitsStateInterface>('visit');

export const isLoadingSelector = createSelector(
  visitsFeatureSelector,
  (visitsState: VisitsStateInterface) => visitsState.isLoading
);
export const visitsSelector = createSelector(
  visitsFeatureSelector,
  (visitsState: VisitsStateInterface) => visitsState.visits
);

export const totalSelector = createSelector(
  visitsFeatureSelector,
  (visitsState: VisitsStateInterface) => visitsState.total
);

export const errorSelector = createSelector(
  visitsFeatureSelector,
  (visitsState: VisitsStateInterface) => visitsState.error
);
