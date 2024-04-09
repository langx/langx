import { createAction, props } from '@ngrx/store';

import { ActionTypes } from 'src/app/store/actions/types/message.actiontypes';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';
import { Message } from 'src/app/models/Message';
import { listMessagesResponseInterface } from 'src/app/models/types/responses/listMessagesResponse.interface';
import { createMessageRequestInterface } from 'src/app/models/types/requests/createMessageRequest.interface';
import { updateMessageRequestInterface } from 'src/app/models/types/requests/updateMessageRequest.interface';
import { deleteMessageRequestInterface } from 'src/app/models/types/requests/deleteMessageRequest.interface';
import { RoomExtendedInterface } from 'src/app/models/types/roomExtended.interface';

// Get Messages With Offset Actions
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
  props<{ request: createMessageRequestInterface }>()
);

export const createMessageSuccessAction = createAction(
  ActionTypes.CREATE_MESSAGE_SUCCESS,
  props<{ payload: Message }>()
);

export const createMessageFailureAction = createAction(
  ActionTypes.CREATE_MESSAGE_FAILURE,
  props<{ error: ErrorInterface; payload: createMessageRequestInterface }>()
);

// Update Message Actions
export const updateMessageAction = createAction(
  ActionTypes.UPDATE_MESSAGE,
  props<{ request: updateMessageRequestInterface }>()
);

export const updateMessageSuccessAction = createAction(
  ActionTypes.UPDATE_MESSAGE_SUCCESS,
  props<{ payload: Message }>()
);

export const updateMessageFailureAction = createAction(
  ActionTypes.UPDATE_MESSAGE_FAILURE,
  props<{ error: ErrorInterface }>()
);

// Delete Message Actions
export const deleteMessageAction = createAction(
  ActionTypes.DELETE_MESSAGE,
  props<{ request: deleteMessageRequestInterface }>()
);

export const deleteMessageSuccessAction = createAction(
  ActionTypes.DELETE_MESSAGE_SUCCESS,
  props<{ payload: Message }>()
);

export const deleteMessageFailureAction = createAction(
  ActionTypes.DELETE_MESSAGE_FAILURE,
  props<{ error: ErrorInterface }>()
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

// Clear Errors Actions\
export const clearErrorsAction = createAction(ActionTypes.CLEAR_ERRORS);
