import { Action, createReducer, on } from '@ngrx/store';

import { LocaleStateInterface } from 'src/app/models/types/states/localeState.interface';
import {
  listCountriesAction,
  listCountriesFailureAction,
  listCountriesSuccessAction,
  listLanguagesAction,
  listLanguagesFailureAction,
  listLanguagesSuccessAction,
} from 'src/app/store/actions/locale.action';

const initialState: LocaleStateInterface = {
  isLoading: false,
  countries: null,
  languages: null,
  error: null,
};

const localeReducer = createReducer(
  initialState,
  on(
    listCountriesAction,
    (state): LocaleStateInterface => ({
      ...state,
      isLoading: true,
      error: null,
    })
  ),
  on(
    listCountriesSuccessAction,
    (state, action): LocaleStateInterface => ({
      ...state,
      isLoading: false,
      countries: action.payload,
    })
  ),
  on(
    listCountriesFailureAction,
    (state, action): LocaleStateInterface => ({
      ...state,
      isLoading: false,
      error: action.error,
    })
  ),
  on(
    listLanguagesAction,
    (state): LocaleStateInterface => ({
      ...state,
      isLoading: true,
      error: null,
    })
  ),
  on(
    listLanguagesSuccessAction,
    (state, action): LocaleStateInterface => ({
      ...state,
      isLoading: false,
      languages: action.payload,
    })
  ),
  on(
    listLanguagesFailureAction,
    (state, action): LocaleStateInterface => ({
      ...state,
      isLoading: false,
      error: action.error,
    })
  )
);

export function localeReducers(state: LocaleStateInterface, action: Action) {
  return localeReducer(state, action);
}
