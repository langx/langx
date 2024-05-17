import { createAction, props } from '@ngrx/store';

import { ActionTypes } from 'src/app/store/actions/types/user.actiontypes';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';
import { User } from 'src/app/models/User';
import { Report } from 'src/app/models/Report';

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
  props<{ request: { data: any } }>()
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

// Report User Actions
export const reportUserAction = createAction(
  ActionTypes.REPORT_USER,
  props<{ request: { userId: string; reason: any } }>()
);

export const reportUserSuccessAction = createAction(
  ActionTypes.REPORT_USER_SUCCESS,
  props<{ payload: Report }>()
);

export const reportUserFailureAction = createAction(
  ActionTypes.REPORT_USER_FAILURE,
  props<{ error: ErrorInterface }>()
);

export const reportUserInitialStateAction = createAction(
  ActionTypes.REPORT_USER_INITIAL_STATE
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

// Unblock User
export const unBlockUserAction = createAction(
  ActionTypes.UNBLOCK_USER,
  props<{ request: { userId: string } }>()
);

export const unBlockUserSuccessAction = createAction(
  ActionTypes.UNBLOCK_USER_SUCCESS,
  props<{ payload: User }>()
);

export const unBlockUserFailureAction = createAction(
  ActionTypes.UNBLOCK_USER_FAILURE,
  props<{ error: ErrorInterface }>()
);

export const unBlockUserInitialStateAction = createAction(
  ActionTypes.UNBLOCK_USER_INITIAL_STATE
);

// Get Blocked Users
export const getBlockedUsersAction = createAction(
  ActionTypes.GET_BLOCKED_USERS,
  props<{ request: { blockedUsers: string[] } }>()
);

export const getBlockedUsersSuccessAction = createAction(
  ActionTypes.GET_BLOCKED_USERS_SUCCESS,
  props<{ payload: User[] }>()
);

export const getBlockedUsersFailureAction = createAction(
  ActionTypes.GET_BLOCKED_USERS_FAILURE,
  props<{ error: ErrorInterface }>()
);

// Clear Errors
export const clearErrorsAction = createAction(ActionTypes.CLEAR_ERRORS);
