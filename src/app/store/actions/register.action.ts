import { createAction, props } from '@ngrx/store';

import { ActionTypes } from '../actionTypes';
import { RegisterRequestInterface } from '../../models/types/requests/registerRequest.interface';
import { Account } from '../../models/Account';

export const registerAction = createAction(
  ActionTypes.REGISTER,
  props<{ request: RegisterRequestInterface }>()
);

export const registerSuccessAction = createAction(
  ActionTypes.REGISTER_SUCCESS,
  props<{ currentUser: Account }>()
);

export const registerFailureAction = createAction(ActionTypes.REGISTER_FAILURE);
