import { createAction, props } from '@ngrx/store';

import { ActionTypes } from 'src/app/store/actions/auth.actiontypes';
import { Account } from 'src/app/models/Account';
import { User } from 'src/app/models/User';
import { LoginRequestInterface } from 'src/app/models/types/requests/loginRequest.interface';
import { RegisterRequestInterface } from 'src/app/models/types/requests/registerRequest.interface';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';
import { CompleteRegistrationRequestInterface } from 'src/app/models/types/requests/completeRegistrationRequest.interface';
import { AddLanguageRequestInterface } from 'src/app/models/types/requests/addLanguageRequest.interface';
import { Language } from 'src/app/models/Language';
import { isLoggedInResponseInterface } from 'src/app/models/types/responses/isLoggedInResponse.interface';

// Login
export const loginAction = createAction(
  ActionTypes.LOGIN,
  props<{ request: LoginRequestInterface }>()
);

export const loginSuccessAction = createAction(
  ActionTypes.LOGIN_SUCCESS,
  props<{ payload: Account }>()
);

export const loginFailureAction = createAction(
  ActionTypes.LOGIN_FAILURE,
  props<{ error: ErrorInterface }>()
);

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
  props<{ request: CompleteRegistrationRequestInterface; id: string }>()
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
  props<{ request: AddLanguageRequestInterface[] }>()
);

export const languageSelectionSuccessAction = createAction(
  ActionTypes.LANGUAGE_SELECTION_SUCCESS,
  props<{ payload: Language[] }>()
);

export const languageSelectionFailureAction = createAction(
  ActionTypes.LANGUAGE_SELECTION_FAILURE,
  props<{ error: ErrorInterface }>()
);

export const updateLanguageArrayAction = createAction(
  ActionTypes.UPDATE_LANGUAGE_ARRAY,
  props<{ request: string[]; id: string }>()
);

export const updateLanguageArraySuccessAction = createAction(
  ActionTypes.UPDATE_LANGUAGE_ARRAY_SUCCESS,
  props<{ payload: User }>()
);

export const updateLanguageArrayFailureAction = createAction(
  ActionTypes.UPDATE_LANGUAGE_ARRAY_FAILURE,
  props<{ error: ErrorInterface }>()
);

// isLoggedIn
export const isLoggedInAction = createAction(ActionTypes.ISLOGGEDIN);

export const isLoggedInSuccessAction = createAction(
  ActionTypes.ISLOGGEDIN_SUCCESS,
  props<{ payload: isLoggedInResponseInterface }>()
);

export const isLoggedInFailureAction = createAction(
  ActionTypes.ISLOGGEDIN_FAILURE,
  props<{ error: ErrorInterface }>()
);
