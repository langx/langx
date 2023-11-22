import { createFeatureSelector, createSelector } from '@ngrx/store';

import { LocaleStateInterface } from 'src/app/models/types/states/localeState.interface';

export const localeFeatureSelector =
  createFeatureSelector<LocaleStateInterface>('locale');

export const countriesSelector = createSelector(
  localeFeatureSelector,
  (localeState: LocaleStateInterface) => localeState.countries
);

export const languagesSelector = createSelector(
  localeFeatureSelector,
  (localeState: LocaleStateInterface) => localeState.languages
);
