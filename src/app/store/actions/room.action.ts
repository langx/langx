import { createAction, props } from '@ngrx/store';

import { ActionTypes } from 'src/app/store/actions/room.actiontypes';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';
import { getRoomsResponseInterface } from 'src/app/models/types/responses/getRoomsResponse.interface';
import { getMessagesResponseInterface } from 'src/app/models/types/responses/getMessagesResponse.interface';
import { Message } from 'src/app/models/Message';
import { createMessageRequest } from 'src/app/models/types/requests/createMessageRequest.interface';

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

// Get Messages Actions
export const getMessagesAction = createAction(
  ActionTypes.GET_MESSAGES,
  // TODO: Create interface for this request
  props<{ roomId: string }>()
);

export const getMessagesSuccessAction = createAction(
  ActionTypes.GET_MESSAGES_SUCCESS,
  props<{ payload: getMessagesResponseInterface }>()
);

export const getMessagesFailureAction = createAction(
  ActionTypes.GET_MESSAGES_FAILURE,
  props<{ error: ErrorInterface }>()
);

export const getMessagesWithOffsetAction = createAction(
  ActionTypes.GET_MESSAGES_WITH_OFFSET,
  // TODO: Create interface for this request
  props<{ roomId: string; offset: number }>()
);

export const getMessagesWithOffsetSuccessAction = createAction(
  ActionTypes.GET_MESSAGES_WITH_OFFSET_SUCCESS,
  props<{ payload: getMessagesResponseInterface }>()
);

export const getMessagesWithOffsetFailureAction = createAction(
  ActionTypes.GET_MESSAGES_WITH_OFFSET_FAILURE,
  props<{ error: ErrorInterface }>()
);

// Create Message Actions
export const createMessageAction = createAction(
  ActionTypes.CREATE_MESSAGE,
  props<{ request: createMessageRequest; currentUserId: string }>()
);

export const createMessageSuccessAction = createAction(
  ActionTypes.CREATE_MESSAGE_SUCCESS,
  props<{ payload: Message }>()
);

export const createMessageFailureAction = createAction(
  ActionTypes.CREATE_MESSAGE_FAILURE,
  props<{ error: ErrorInterface }>()
);
