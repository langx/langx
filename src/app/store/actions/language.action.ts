import { createAction, props } from '@ngrx/store';

import { ActionTypes } from 'src/app/store/actions/types/language.actiontypes';
import { Language } from 'src/app/models/Language';
import { User } from 'src/app/models/User';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';
import { createLanguageRequestInterface } from 'src/app/models/types/requests/createLanguageRequest.interface';
import { deleteLanguageRequestInterface } from 'src/app/models/types/requests/deleteLanguageRequest.interface';
import { updateLanguageRequestInterface } from 'src/app/models/types/requests/updateLanguageRequest.interface';

// Create Language Actions
export const createLanguageAction = createAction(
  ActionTypes.CREATE_LANGUAGE,
  props<{ request: createLanguageRequestInterface; languageArray: string[] }>()
);

export const createLanguageSuccessAction = createAction(
  ActionTypes.CREATE_LANGUAGE_SUCCESS,
  props<{ payload: User }>()
);

export const createLanguageFailureAction = createAction(
  ActionTypes.CREATE_LANGUAGE_FAILURE,
  props<{ error: ErrorInterface }>()
);

// Update Language Actions
export const updateLanguageAction = createAction(
  ActionTypes.UPDATE_LANGUAGE,
  // TODO: Add request interface here
  props<{ request: updateLanguageRequestInterface }>()
);

export const updateLanguageSuccessAction = createAction(
  ActionTypes.UPDATE_LANGUAGE_SUCCESS,
  props<{ payload: Language }>()
);

export const updateLanguageFailureAction = createAction(
  ActionTypes.UPDATE_LANGUAGE_FAILURE,
  props<{ error: ErrorInterface }>()
);

// Delete Language Actions
export const deleteLanguageAction = createAction(
  ActionTypes.DELETE_LANGUAGE,
  props<{ request: deleteLanguageRequestInterface }>()
);

export const deleteLanguageSuccessAction = createAction(
  ActionTypes.DELETE_LANGUAGE_SUCCESS,
  props<{ payload: User }>()
);

export const deleteLanguageFailureAction = createAction(
  ActionTypes.DELETE_LANGUAGE_FAILURE,
  props<{ error: ErrorInterface }>()
);
