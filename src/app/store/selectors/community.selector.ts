import { createFeatureSelector, createSelector } from '@ngrx/store';

import { CommunityStateInterface } from 'src/app/models/types/states/communityState.interface';

export const authFeatureSelector =
  createFeatureSelector<CommunityStateInterface>('community');

export const isLoadingSelector = createSelector(
  authFeatureSelector,
  (communityState: CommunityStateInterface) => communityState.isLoading
);

export const usersSelector = createSelector(
  authFeatureSelector,
  (communityState: CommunityStateInterface) => communityState.users
);

export const errorSelector = createSelector(
  authFeatureSelector,
  (communityState: CommunityStateInterface) => communityState.error
);
