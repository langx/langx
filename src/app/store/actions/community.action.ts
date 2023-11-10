import { createAction, props } from '@ngrx/store';

import { ActionTypes } from 'src/app/store/actions/community.actiontypes';
import { User } from 'src/app/models/User';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';

// Get Users
export const getUsersAction = createAction(ActionTypes.GETUSERS);

export const getUsersSuccessAction = createAction(
  ActionTypes.GETUSERS_SUCCESS,
  props<{ payload: User[] }>()
);

export const getUsersFailureAction = createAction(
  ActionTypes.GETUSERS_FAILURE,
  props<{ error: ErrorInterface }>()
);
