import { createAction, props } from '@ngrx/store';

import { ActionTypes } from 'src/app/store/actions/types/user.actiontypes';
import { listUsersResponseInterface } from 'src/app/models/types/responses/listUsersResponse.interface';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';
import { FilterDataInterface } from 'src/app/models/types/filterData.interface';

// Get Users Actions
export const getUserAction = createAction(
  ActionTypes.GET_USER,
  // TODO: Create interface for this request
  props<{ filterData: FilterDataInterface }>()
);

export const getUserSuccessAction = createAction(
  ActionTypes.GET_USER_SUCCESS,
  props<{ payload: listUsersResponseInterface }>()
);

export const getUserFailureAction = createAction(
  ActionTypes.GET_USER_FAILURE,
  props<{ error: ErrorInterface }>()
);
