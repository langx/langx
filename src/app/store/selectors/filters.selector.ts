import { createFeatureSelector, createSelector } from '@ngrx/store';

import { FiltersStateInterface } from 'src/app/models/types/states/filtersState.interface';

export const contributorsFeatureSelector =
  createFeatureSelector<FiltersStateInterface>('filter');

export const isLoadingSelector = createSelector(
  contributorsFeatureSelector,
  (filtersState: FiltersStateInterface) => filtersState.isLoading
);

export const filterDataSelector = createSelector(
  contributorsFeatureSelector,
  (filtersState: FiltersStateInterface) => filtersState.filterData
);

export const errorSelector = createSelector(
  contributorsFeatureSelector,
  (filtersState: FiltersStateInterface) => filtersState.error
);
