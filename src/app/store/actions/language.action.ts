import { createAction, props } from '@ngrx/store';

import { ActionTypes } from 'src/app/store/actions/types/language.actiontypes';
import { Language } from 'src/app/models/Language';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';

export const updateLanguageAction = createAction(
  ActionTypes.UPDATE_LANGUAGE,
  props<{ request: { id: string; data: { level: number } } }>()
);

export const updateLanguageSuccessAction = createAction(
  ActionTypes.UPDATE_LANGUAGE_SUCCESS,
  props<{ payload: Language }>()
);

export const updateLanguageFailureAction = createAction(
  ActionTypes.UPDATE_LANGUAGE_FAILURE,
  props<{ error: ErrorInterface }>()
);
