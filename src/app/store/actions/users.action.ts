import { createAction, props } from '@ngrx/store';

import { ActionTypes } from 'src/app/store/actions/types/users.actiontypes';
import { listUsersResponseInterface } from 'src/app/models/types/responses/listUsersResponse.interface';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';
import { FilterDataInterface } from 'src/app/models/types/filterData.interface';

// Get Users By Target Language Actions
export const getUsersByTargetLanguageAction = createAction(
  ActionTypes.GET_USERS_BY_TARGET_LANGUAGE,
  props<{ request: { filterData: FilterDataInterface } }>()
);

export const getUsersByTargetLanguageSuccessAction = createAction(
  ActionTypes.GET_USERS_BY_TARGET_LANGUAGE_SUCCESS,
  props<{ payload: listUsersResponseInterface }>()
);

export const getUsersByTargetLanguageFailureAction = createAction(
  ActionTypes.GET_USERS_BY_TARGET_LANGUAGE_FAILURE,
  props<{ error: ErrorInterface }>()
);

// Get Users By Target Language With Offset Actions
export const getUsersByTargetLanguageWithOffsetAction = createAction(
  ActionTypes.GET_USERS_BY_TARGET_LANGUAGE_WITH_OFFSET,
  props<{
    request: {
      filterData: FilterDataInterface;
      offset: number;
    };
  }>()
);

export const getUsersByTargetLanguageWithOffsetSuccessAction = createAction(
  ActionTypes.GET_USERS_BY_TARGET_LANGUAGE_WITH_OFFSET_SUCCESS,
  props<{ payload: listUsersResponseInterface }>()
);

export const getUsersByTargetLanguageWithOffsetFailureAction = createAction(
  ActionTypes.GET_USERS_BY_TARGET_LANGUAGE_WITH_OFFSET_FAILURE,
  props<{ error: ErrorInterface }>()
);

// Get Users By Last Seen Actions
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

// Get Users By Last Seen With Offset Actions
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

// Get Users By Created At Actions
export const getUsersByCreatedAtAction = createAction(
  ActionTypes.GET_USERS_BY_CREATED_AT,
  props<{ request: { filterData: FilterDataInterface } }>()
);

export const getUsersByCreatedAtSuccessAction = createAction(
  ActionTypes.GET_USERS_BY_CREATED_AT_SUCCESS,
  props<{ payload: listUsersResponseInterface }>()
);

export const getUsersByCreatedAtFailureAction = createAction(
  ActionTypes.GET_USERS_BY_CREATED_AT_FAILURE,
  props<{ error: ErrorInterface }>()
);

// Get Users By Created At With Offset Actions
export const getUsersByCreatedAtWithOffsetAction = createAction(
  ActionTypes.GET_USERS_BY_CREATED_AT_WITH_OFFSET,
  props<{
    request: {
      filterData: FilterDataInterface;
      offset: number;
    };
  }>()
);

export const getUsersByCreatedAtWithOffsetSuccessAction = createAction(
  ActionTypes.GET_USERS_BY_CREATED_AT_WITH_OFFSET_SUCCESS,
  props<{ payload: listUsersResponseInterface }>()
);

export const getUsersByCreatedAtWithOffsetFailureAction = createAction(
  ActionTypes.GET_USERS_BY_CREATED_AT_WITH_OFFSET_FAILURE,
  props<{ error: ErrorInterface }>()
);
