import { createAction, props } from '@ngrx/store';

import { ActionTypes } from 'src/app/store/actions/types/language.actiontypes';
import { Language } from 'src/app/models/Language';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';

// Create Language Actions
export const createLanguageAction = createAction(
  ActionTypes.CREATE_LANGUAGE,
  // TODO: Add request interface here
  props<{ request: any }>()
);

export const createLanguageSuccessAction = createAction(
  ActionTypes.CREATE_LANGUAGE_SUCCESS,
  props<{ payload: Language }>()
);

export const createLanguageFailureAction = createAction(
  ActionTypes.CREATE_LANGUAGE_FAILURE,
  props<{ error: ErrorInterface }>()
);

// Update Language Actions
export const updateLanguageAction = createAction(
  ActionTypes.UPDATE_LANGUAGE,
  // TODO: Add request interface here
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
