import { createAction, props } from '@ngrx/store';

import { ActionTypes } from 'src/app/store/actions/types/rooms.actiontypes';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';
import { listRoomsResponseInterface } from 'src/app/models/types/responses/listRoomsResponse.interface';

// Get Rooms Actions
export const getRoomsAction = createAction(
  ActionTypes.GET_ROOMS,
  // TODO: Create interface for this request
  props<{ currentUserId: string }>()
);

export const getRoomsSuccessAction = createAction(
  ActionTypes.GET_ROOMS_SUCCESS,
  props<{ payload: listRoomsResponseInterface }>()
);

export const getRoomsFailureAction = createAction(
  ActionTypes.GET_ROOMS_FAILURE,
  props<{ error: ErrorInterface }>()
);

// Get Rooms With Offset Actions
export const getRoomsWithOffsetAction = createAction(
  ActionTypes.GET_ROOMS_WITH_OFFSET,
  // TODO: Create interface for this request
  props<{ currentUserId: string; offset: number }>()
);

export const getRoomsWithOffsetSuccessAction = createAction(
  ActionTypes.GET_ROOMS_WITH_OFFSET_SUCCESS,
  props<{ payload: listRoomsResponseInterface }>()
);

export const getRoomsWithOffsetFailureAction = createAction(
  ActionTypes.GET_ROOMS_WITH_OFFSET_FAILURE,
  props<{ error: ErrorInterface }>()
);
