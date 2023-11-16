import { createAction, props } from '@ngrx/store';

import { ActionTypes } from 'src/app/store/actions/users.actiontypes';
import { listUsersResponseInterface } from 'src/app/models/types/responses/listUsersResponse.interface';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';
import { FilterDataInterface } from 'src/app/models/types/filterData.interface';

// Get Users Actions
export const getUsersAction = createAction(
  ActionTypes.GET_USERS,
  // TODO: Create interface for this request
  props<{ filterData: FilterDataInterface }>()
);

export const getUsersSuccessAction = createAction(
  ActionTypes.GET_USERS_SUCCESS,
  props<{ payload: listUsersResponseInterface }>()
);

export const getUsersFailureAction = createAction(
  ActionTypes.GET_USERS_FAILURE,
  props<{ error: ErrorInterface }>()
);

// Get Users With Offset Actions
export const getUsersWithOffsetAction = createAction(
  ActionTypes.GET_USERS_WITH_OFFSET,
  // TODO: Create interface for this request
  props<{ filterData: FilterDataInterface; offset: number }>()
);

export const getUsersWithOffsetSuccessAction = createAction(
  ActionTypes.GET_USERS_WITH_OFFSET_SUCCESS,
  props<{ payload: listUsersResponseInterface }>()
);

export const getUsersWithOffsetFailureAction = createAction(
  ActionTypes.GET_USERS_WITH_OFFSET_FAILURE,
  props<{ error: ErrorInterface }>()
);
