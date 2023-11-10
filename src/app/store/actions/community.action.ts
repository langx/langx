import { createAction, props } from '@ngrx/store';

import { ActionTypes } from 'src/app/store/actions/community.actiontypes';
import { getUsersResponseInterface } from 'src/app/models/types/responses/getUsersResponse.interface';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';

// Get Users
export const getUsersAction = createAction(ActionTypes.GETUSERS);

export const getUsersSuccessAction = createAction(
  ActionTypes.GETUSERS_SUCCESS,
  props<{ payload: getUsersResponseInterface }>()
);

export const getUsersFailureAction = createAction(
  ActionTypes.GETUSERS_FAILURE,
  props<{ error: ErrorInterface }>()
);
