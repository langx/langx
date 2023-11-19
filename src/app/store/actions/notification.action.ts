import { createAction, props } from '@ngrx/store';

import { ActionTypes } from 'src/app/store/actions/types/notification.actiontypes';
import { MessageExtendedInterface } from 'src/app/models/types/messageExtended.interface';
import { Room } from 'src/app/models/Room';

export const findAndUpdateRoomUpdatedAtAction = createAction(
  ActionTypes.FIND_AND_UPDATE_ROOM_UPDATED_AT,
  props<{ payload: Room }>()
);

export const findAndUpdateRoomMessageAction = createAction(
  ActionTypes.FIND_AND_UPDATE_ROOM_MESSAGE,
  props<{ payload: MessageExtendedInterface }>()
);
