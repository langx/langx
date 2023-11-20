import { createFeatureSelector, createSelector } from '@ngrx/store';

import { UserStateInterface } from 'src/app/models/types/states/userState.interface';

export const userFeatureSelector =
  createFeatureSelector<UserStateInterface>('user');

export const isLoadingSelector = createSelector(
  userFeatureSelector,
  (userState: UserStateInterface) => userState.isLoading
);

export const usersSelector = createSelector(
  userFeatureSelector,
  (userState: UserStateInterface) => userState.users
);

export const totalSelector = createSelector(
  userFeatureSelector,
  (userState: UserStateInterface) => userState.total
);

export const errorSelector = createSelector(
  userFeatureSelector,
  (userState: UserStateInterface) => userState.error
);

export const userSelector = createSelector(
  userFeatureSelector,
  (userState: UserStateInterface) => userState.user
);
