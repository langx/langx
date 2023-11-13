import { createFeatureSelector, createSelector } from '@ngrx/store';

import { CommunityStateInterface } from 'src/app/models/types/states/communityState.interface';

export const communityFeatureSelector =
  createFeatureSelector<CommunityStateInterface>('community');

export const isLoadingSelector = createSelector(
  communityFeatureSelector,
  (communityState: CommunityStateInterface) => communityState.isLoading
);

export const usersSelector = createSelector(
  communityFeatureSelector,
  (communityState: CommunityStateInterface) => communityState.users
);

export const totalSelector = createSelector(
  communityFeatureSelector,
  (communityState: CommunityStateInterface) => communityState.total
);

export const errorSelector = createSelector(
  communityFeatureSelector,
  (communityState: CommunityStateInterface) => communityState.error
);
