import { createAction, props } from '@ngrx/store';

import { ActionTypes } from 'src/app/store/actions/types/notification.actiontypes';
import { Room } from 'src/app/models/Room';
import { RoomExtendedInterface } from 'src/app/models/types/roomExtended.interface';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';
import { MessageExtendedInterface } from 'src/app/models/types/messageExtended.interface';

export const findOrAddRoomAction = createAction(
  ActionTypes.FIND_OR_ADD_ROOM,
  props<{ payload: Room; currentUserId: string }>()
);

export const findOrAddRoomSuccessAction = createAction(
  ActionTypes.FIND_OR_ADD_ROOM_SUCCESS,
  props<{ payload: RoomExtendedInterface }>()
);

export const findOrAddRoomFailureAction = createAction(
  ActionTypes.FIND_OR_ADD_ROOM_FAILURE,
  props<{ error: ErrorInterface }>()
);

export const findAndUpdateRoomUpdatedAtAction = createAction(
  ActionTypes.FIND_AND_UPDATE_ROOM_UPDATED_AT,
  props<{ payload: Room }>()
);

export const findRoomAndAddMessageAction = createAction(
  ActionTypes.FIND_ROOM_AND_ADD_MESSAGE,
  props<{ payload: MessageExtendedInterface }>()
);

export const findActiveRoomAndAddMessageAction = createAction(
  ActionTypes.FIND_ACTIVE_ROOM_AND_ADD_MESSAGE,
  props<{ payload: MessageExtendedInterface }>()
);

export const findActiveRoomAndUpdateMessageSeenAction = createAction(
  ActionTypes.FIND_ACTIVE_ROOM_AND_UPDATE_MESSAGE_SEEN,
  props<{ payload: MessageExtendedInterface }>()
);

export const totalUnseenMessagesAction = createAction(
  ActionTypes.TOTAL_UNSEEN_MESSAGES,
  props<{ payload: number }>()
);
