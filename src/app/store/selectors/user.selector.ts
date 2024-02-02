import { createFeatureSelector, createSelector } from '@ngrx/store';

import { UserStateInterface } from 'src/app/models/types/states/userState.interface';

export const userFeatureSelector =
  createFeatureSelector<UserStateInterface>('user');

export const isLoadingSelector = createSelector(
  userFeatureSelector,
  (userState: UserStateInterface) => userState.isLoading
);

export const usersByLastSeenSelector = createSelector(
  userFeatureSelector,
  (userState: UserStateInterface) => userState.usersByLastSeen
);

export const totalByLastSeenSelector = createSelector(
  userFeatureSelector,
  (userState: UserStateInterface) => userState.totalByLastSeen
);

export const usersByCreatedAtSelector = createSelector(
  userFeatureSelector,
  (userState: UserStateInterface) => userState.usersByCreatedAt
);

export const totalByCreatedAtSelector = createSelector(
  userFeatureSelector,
  (userState: UserStateInterface) => userState.totalByCreatedAt
);

export const errorSelector = createSelector(
  userFeatureSelector,
  (userState: UserStateInterface) => userState.error
);

export const userSelector = createSelector(
  userFeatureSelector,
  (userState: UserStateInterface) => userState.user
);

export const reportSelector = createSelector(
  userFeatureSelector,
  (userState: UserStateInterface) => userState.report
);
