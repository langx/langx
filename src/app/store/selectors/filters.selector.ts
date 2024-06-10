import { createFeatureSelector, createSelector } from '@ngrx/store';

import { FiltersStateInterface } from 'src/app/models/types/states/filtersState.interface';

export const contributorsFeatureSelector =
  createFeatureSelector<FiltersStateInterface>('filter');

export const filterDataSelector = createSelector(
  contributorsFeatureSelector,
  (filtersState: FiltersStateInterface) => filtersState.filterData
);
