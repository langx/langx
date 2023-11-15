import { createAction, props } from '@ngrx/store';

import { ActionTypes } from 'src/app/store/actions/rooms.actiontypes';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';
import { getRoomsResponseInterface } from 'src/app/models/types/responses/getRoomsResponse.interface';

// Get Rooms Actions
export const getRoomsAction = createAction(
  ActionTypes.GET_ROOMS,
  // TODO: Create interface for this request
  props<{ currentUserId: string }>()
);

export const getRoomsSuccessAction = createAction(
  ActionTypes.GET_ROOMS_SUCCESS,
  props<{ payload: getRoomsResponseInterface }>()
);

export const getRoomsFailureAction = createAction(
  ActionTypes.GET_ROOMS_FAILURE,
  props<{ error: ErrorInterface }>()
);

export const getRoomsWithOffsetAction = createAction(
  ActionTypes.GET_ROOMS_WITH_OFFSET,
  // TODO: Create interface for this request
  props<{ currentUserId: string; offset: number }>()
);

export const getRoomsWithOffsetSuccessAction = createAction(
  ActionTypes.GET_ROOMS_WITH_OFFSET_SUCCESS,
  props<{ payload: getRoomsResponseInterface }>()
);

export const getRoomsWithOffsetFailureAction = createAction(
  ActionTypes.GET_ROOMS_WITH_OFFSET_FAILURE,
  props<{ error: ErrorInterface }>()
);
