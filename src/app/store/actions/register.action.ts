import { createAction, props } from '@ngrx/store';

import { ActionTypes } from '../actionTypes';
import { Account } from 'src/app/models/Account';
import { User } from 'src/app/models/User';
import { RegisterRequestInterface } from 'src/app/models/types/requests/registerRequest.interface';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';
import { CompleteRegistrationRequestInterface } from 'src/app/models/types/requests/completeRegistrationRequest.interface';

// Register
export const registerAction = createAction(
  ActionTypes.REGISTER,
  props<{ request: RegisterRequestInterface }>()
);

export const registerSuccessAction = createAction(
  ActionTypes.REGISTER_SUCCESS,
  props<{ payload: Account }>()
);

export const registerFailureAction = createAction(
  ActionTypes.REGISTER_FAILURE,
  props<{ error: ErrorInterface }>()
);

// Complete Registration
export const completeRegistrationAction = createAction(
  ActionTypes.COMPLETE_REGISTRATION,
  props<{ request: CompleteRegistrationRequestInterface }>()
);

export const completeRegistrationSuccessAction = createAction(
  ActionTypes.COMPLETE_REGISTRATION_SUCCESS,
  props<{ payload: User }>()
);

export const completeRegistrationFailureAction = createAction(
  ActionTypes.COMPLETE_REGISTRATION_FAILURE,
  props<{ error: ErrorInterface }>()
);

// Language Selection
export const languageSelectionAction = createAction(
  ActionTypes.LANGUAGE_SELECTION,
  props<{ language: string }>()
);

export const languageSelectionSuccessAction = createAction(
  ActionTypes.LANGUAGE_SELECTION_SUCCESS,
  props<{ payload: User }>()
);

export const languageSelectionFailureAction = createAction(
  ActionTypes.LANGUAGE_SELECTION_FAILURE,
  props<{ error: ErrorInterface }>()
);
