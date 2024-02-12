import { createFeatureSelector, createSelector } from '@ngrx/store';

import { ContributorsStateInterface } from 'src/app/models/types/states/contributorsState.interface';

export const contributorsFeatureSelector =
  createFeatureSelector<ContributorsStateInterface>('contributor');

export const isLoadingSelector = createSelector(
  contributorsFeatureSelector,
  (contributorsState: ContributorsStateInterface) => contributorsState.isLoading
);
export const usersSelector = createSelector(
  contributorsFeatureSelector,
  (contributorsState: ContributorsStateInterface) => contributorsState.users
);

export const totalSelector = createSelector(
  contributorsFeatureSelector,
  (contributorsState: ContributorsStateInterface) => contributorsState.total
);

export const errorSelector = createSelector(
  contributorsFeatureSelector,
  (contributorsState: ContributorsStateInterface) => contributorsState.error
);
