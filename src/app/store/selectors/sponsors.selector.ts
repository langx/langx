import { createFeatureSelector, createSelector } from '@ngrx/store';

import { SponsorsStateInterface } from 'src/app/models/types/states/sponsorsState.interface';

export const sponsorsFeatureSelector =
  createFeatureSelector<SponsorsStateInterface>('sponsor');

export const isLoadingSelector = createSelector(
  sponsorsFeatureSelector,
  (sponsorsState: SponsorsStateInterface) => sponsorsState.isLoading
);
export const usersSelector = createSelector(
  sponsorsFeatureSelector,
  (sponsorsState: SponsorsStateInterface) => sponsorsState.users
);

export const totalSelector = createSelector(
  sponsorsFeatureSelector,
  (sponsorsState: SponsorsStateInterface) => sponsorsState.total
);

export const errorSelector = createSelector(
  sponsorsFeatureSelector,
  (sponsorsState: SponsorsStateInterface) => sponsorsState.error
);
