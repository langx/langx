import { createFeatureSelector, createSelector } from '@ngrx/store';

import { LocaleStateInterface } from 'src/app/models/types/states/localeState.interface';

export const localeFeatureSelector =
  createFeatureSelector<LocaleStateInterface>('locale');

export const listCountriesSelector = createSelector(
  localeFeatureSelector,
  (localeState: LocaleStateInterface) => localeState.countries
);

export const listLanguagesSelector = createSelector(
  localeFeatureSelector,
  (localeState: LocaleStateInterface) => localeState.languages
);
