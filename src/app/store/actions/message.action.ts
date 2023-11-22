import { createAction, props } from '@ngrx/store';

import { ActionTypes } from 'src/app/store/actions/types/message.actiontypes';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';
import { listMessagesResponseInterface } from 'src/app/models/types/responses/listMessagesResponse.interface';
import { Message } from 'src/app/models/Message';
import { createMessageRequestInterface } from 'src/app/models/types/requests/createMessageRequest.interface';
import { RoomExtendedInterface } from 'src/app/models/types/roomExtended.interface';
import { tempMessageInterface } from 'src/app/models/types/tempMessage.interface';

// Get Messages Actions
export const getMessagesAction = createAction(
  ActionTypes.GET_MESSAGES,
  // TODO: Create interface for this request
  props<{ roomId: string }>()
);

export const getMessagesSuccessAction = createAction(
  ActionTypes.GET_MESSAGES_SUCCESS,
  props<{ payload: listMessagesResponseInterface }>()
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
  props<{ payload: listMessagesResponseInterface }>()
);

export const getMessagesWithOffsetFailureAction = createAction(
  ActionTypes.GET_MESSAGES_WITH_OFFSET_FAILURE,
  props<{ error: ErrorInterface }>()
);

// Create Message Actions
export const createMessageAction = createAction(
  ActionTypes.CREATE_MESSAGE,
  props<{ request: createMessageRequestInterface; currentUserId: string }>()
);

export const createMessageSuccessAction = createAction(
  ActionTypes.CREATE_MESSAGE_SUCCESS,
  props<{ payload: Message }>()
);

export const createMessageFailureAction = createAction(
  ActionTypes.CREATE_MESSAGE_FAILURE,
  props<{ error: ErrorInterface; payload: createMessageRequestInterface }>()
);

// Activate/Deactivate Room Actions
export const activateRoomAction = createAction(
  ActionTypes.ACTIVATE_ROOM,
  props<{ payload: RoomExtendedInterface }>()
);

export const deactivateRoomAction = createAction(
  ActionTypes.DEACTIVATE_ROOM,
  props<{ payload: RoomExtendedInterface }>()
);

// Update Message Actions
export const updateMessageSeenAction = createAction(
  ActionTypes.UPDATE_MESSAGE_SEEN,
  props<{ request: Message }>()
);

export const updateMessageSeenSuccessAction = createAction(
  ActionTypes.UPDATE_MESSAGE_SEEN_SUCCESS,
  props<{ payload: Message }>()
);

export const updateMessageSeenFailureAction = createAction(
  ActionTypes.UPDATE_MESSAGE_SEEN_FAILURE,
  props<{ error: ErrorInterface }>()
);

// Remove Message From Temp Messages Actions
export const removeMessageFromTempMessagesAction = createAction(
  ActionTypes.REMOVE_MESSAGE_FROM_TEMP_MESSAGES,
  props<{ payload: tempMessageInterface }>()
);
