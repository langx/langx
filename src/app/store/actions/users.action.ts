import { createAction, props } from '@ngrx/store';

import { ActionTypes } from 'src/app/store/actions/types/users.actiontypes';
import { listUsersResponseInterface } from 'src/app/models/types/responses/listUsersResponse.interface';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';
import { FilterDataInterface } from 'src/app/models/types/filterData.interface';

// Get Users Actions
export const getUsersByLastSeenAction = createAction(
  ActionTypes.GET_USERS_BY_LAST_SEEN,
  props<{ request: { filterData: FilterDataInterface } }>()
);

export const getUsersByLastSeenSuccessAction = createAction(
  ActionTypes.GET_USERS_BY_LAST_SEEN_SUCCESS,
  props<{ payload: listUsersResponseInterface }>()
);

export const getUsersByLastSeenFailureAction = createAction(
  ActionTypes.GET_USERS_BY_LAST_SEEN_FAILURE,
  props<{ error: ErrorInterface }>()
);

// Get Users With Offset Actions
export const getUsersByLastSeenWithOffsetAction = createAction(
  ActionTypes.GET_USERS_BY_LAST_SEEN_WITH_OFFSET,
  props<{
    request: {
      filterData: FilterDataInterface;
      offset: number;
    };
  }>()
);

export const getUsersByLastSeenWithOffsetSuccessAction = createAction(
  ActionTypes.GET_USERS_BY_LAST_SEEN_WITH_OFFSET_SUCCESS,
  props<{ payload: listUsersResponseInterface }>()
);

export const getUsersByLastSeenWithOffsetFailureAction = createAction(
  ActionTypes.GET_USERS_BY_LAST_SEEN_WITH_OFFSET_FAILURE,
  props<{ error: ErrorInterface }>()
);
