import { createFeatureSelector, createSelector } from '@ngrx/store';

import { StreaksStateInterface } from 'src/app/models/types/states/streaksState.interface';

export const streaksFeatureSelector =
  createFeatureSelector<StreaksStateInterface>('streak');

export const isLoadingSelector = createSelector(
  streaksFeatureSelector,
  (streaksState: StreaksStateInterface) => streaksState.isLoading
);
export const streaksSelector = createSelector(
  streaksFeatureSelector,
  (streaksState: StreaksStateInterface) => streaksState.streaks
);

export const totalSelector = createSelector(
  streaksFeatureSelector,
  (streaksState: StreaksStateInterface) => streaksState.total
);

export const errorSelector = createSelector(
  streaksFeatureSelector,
  (streaksState: StreaksStateInterface) => streaksState.error
);
