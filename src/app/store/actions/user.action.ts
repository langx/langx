import { createAction, props } from '@ngrx/store';

import { ActionTypes } from 'src/app/store/actions/types/user.actiontypes';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';
import { User } from 'src/app/models/User';

// Get User Actions
export const getUserAction = createAction(
  ActionTypes.GET_USER,
  // TODO: Add request interface
  props<{ userId: string }>()
);

export const getUserSuccessAction = createAction(
  ActionTypes.GET_USER_SUCCESS,
  // TODO: Add interface
  props<{ payload: User }>()
);

export const getUserFailureAction = createAction(
  ActionTypes.GET_USER_FAILURE,
  props<{ error: ErrorInterface }>()
);

export const updateUserAction = createAction(
  ActionTypes.UPDATE_USER,
  // TODO: Add request interface
  props<{ request: { userId: string } }>()
);

export const updateUserSuccessAction = createAction(
  ActionTypes.UPDATE_USER_SUCCESS,
  props<{ payload: User }>()
);

export const updateUserFailureAction = createAction(
  ActionTypes.UPDATE_USER_FAILURE,
  props<{ error: ErrorInterface }>()
);
