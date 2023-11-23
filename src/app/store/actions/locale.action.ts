import { createAction, props } from '@ngrx/store';

import { ActionTypes } from 'src/app/store/actions/types/locale.actiontypes';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';
import { Countries } from 'src/app/models/locale/Countries';
import { Languages } from 'src/app/models/locale/Languages';

export const listCountriesAction = createAction(ActionTypes.LIST_COUNTRIES);

export const listCountriesSuccessAction = createAction(
  ActionTypes.LIST_COUNTRIES_SUCCESS,
  props<{ payload: Countries }>()
);

export const listCountriesFailureAction = createAction(
  ActionTypes.LIST_COUNTRIES_FAILURE,
  props<{ error: ErrorInterface }>()
);

export const listLanguagesAction = createAction(ActionTypes.LIST_LANGUAGES);

export const listLanguagesSuccessAction = createAction(
  ActionTypes.LIST_LANGUAGES_SUCCESS,
  props<{ payload: Languages }>()
);

export const listLanguagesFailureAction = createAction(
  ActionTypes.LIST_LANGUAGES_FAILURE,
  props<{ error: ErrorInterface }>()
);
