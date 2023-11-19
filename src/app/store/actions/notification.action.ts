import { createAction, props } from '@ngrx/store';

import { ActionTypes } from 'src/app/store/actions/types/notification.actiontypes';
import { MessageExtendedInterface } from 'src/app/models/types/messageExtended.interface';
import { Room } from 'src/app/models/Room';

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
