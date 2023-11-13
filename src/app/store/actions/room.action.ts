import { createAction, props } from '@ngrx/store';

import { ActionTypes } from 'src/app/store/actions/room.actiontypes';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';
import { getRoomsResponseInterface } from 'src/app/models/types/responses/getRoomsResponse.interface';
import { getMessagesResponseInterface } from 'src/app/models/types/responses/getMessagesResponse.interface';

// Get Rooms Actions
export const getRoomsAction = createAction(
  ActionTypes.GETROOMS,
  props<{ currentUserId: string }>()
);

export const getRoomsSuccessAction = createAction(
  ActionTypes.GETROOMS_SUCCESS,
  props<{ payload: getRoomsResponseInterface }>()
);

export const getRoomsFailureAction = createAction(
  ActionTypes.GETROOMS_FAILURE,
  props<{ error: ErrorInterface }>()
);

export const getRoomsWithOffsetAction = createAction(
  ActionTypes.GETROOMS_WITH_OFFSET,
  props<{ currentUserId: string; offset: number }>()
);

export const getRoomsWithOffsetSuccessAction = createAction(
  ActionTypes.GETROOMS_WITH_OFFSET_SUCCESS,
  props<{ payload: getRoomsResponseInterface }>()
);

export const getRoomsWithOffsetFailureAction = createAction(
  ActionTypes.GETROOMS_WITH_OFFSET_FAILURE,
  props<{ error: ErrorInterface }>()
);

// Get Messages Actions
export const getMessagesAction = createAction(
  ActionTypes.GETMESSAGES,
  props<{ roomId: string }>()
);

export const getMessagesSuccessAction = createAction(
  ActionTypes.GETMESSAGES_SUCCESS,
  props<{ payload: getMessagesResponseInterface }>()
);

export const getMessagesFailureAction = createAction(
  ActionTypes.GETMESSAGES_FAILURE,
  props<{ error: ErrorInterface }>()
);
