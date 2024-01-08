import { createAction, props } from '@ngrx/store';

import { ActionTypes } from 'src/app/store/actions/types/user.actiontypes';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';
import { User } from 'src/app/models/User';

// Get User Actions
export const getCurrentUserAction = createAction(
  ActionTypes.GET_CURRENT_USER,
  // TODO: Add request interface
  props<{ userId: string }>()
);

export const getCurrentUserSuccessAction = createAction(
  ActionTypes.GET_CURRENT_USER_SUCCESS,
  // TODO: Add interface
  props<{ payload: User }>()
);

export const getCurrentUserFailureAction = createAction(
  ActionTypes.GET_CURRENT_USER_FAILURE,
  props<{ error: ErrorInterface }>()
);

export const updateCurrentUserAction = createAction(
  ActionTypes.UPDATE_CURRENT_USER,
  // TODO: Add request interface
  props<{ request: { userId: string; data: any } }>()
);

export const updateCurrentUserSuccessAction = createAction(
  ActionTypes.UPDATE_CURRENT_USER_SUCCESS,
  props<{ payload: User }>()
);

export const updateCurrentUserFailureAction = createAction(
  ActionTypes.UPDATE_CURRENT_USER_FAILURE,
  props<{ error: ErrorInterface }>()
);

export const getUserByIdAction = createAction(
  ActionTypes.GET_USER_BY_ID,
  props<{ userId: string }>()
);

export const getUserByIdSuccessAction = createAction(
  ActionTypes.GET_USER_BY_ID_SUCCESS,
  props<{ payload: User }>()
);

export const getUserByIdFailureAction = createAction(
  ActionTypes.GET_USER_BY_ID_FAILURE,
  props<{ error: ErrorInterface }>()
);

// Block User
export const blockUserAction = createAction(
  ActionTypes.BLOCK_USER,
  props<{ request: { userId: string } }>()
);

export const blockUserSuccessAction = createAction(
  ActionTypes.BLOCK_USER_SUCCESS,
  props<{ payload: User }>()
);

export const blockUserFailureAction = createAction(
  ActionTypes.BLOCK_USER_FAILURE,
  props<{ error: ErrorInterface }>()
);

export const blockUserInitialStateAction = createAction(
  ActionTypes.BLOCK_USER_INITIAL_STATE
);
