import { createAction, props } from '@ngrx/store';

import { ActionTypes } from 'src/app/store/actions/types/room.actiontypes';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';
import { RoomExtendedInterface } from 'src/app/models/types/roomExtended.interface';

// Get Room By Id Actions
export const getRoomByIdAction = createAction(
  ActionTypes.GET_ROOM_BY_ID,
  props<{ currentUserId: string; roomId: string }>()
);

export const getRoomByIdSuccessAction = createAction(
  ActionTypes.GET_ROOM_BY_ID_SUCCESS,
  props<{ payload: RoomExtendedInterface; currentUserId: string }>()
);

export const getRoomByIdFailureAction = createAction(
  ActionTypes.GET_ROOM_BY_ID_FAILURE,
  props<{ error: ErrorInterface }>()
);

// Fill Room By Id With User Data Actions
export const fillRoomByIdWithUserDataSuccessAction = createAction(
  ActionTypes.FILL_ROOM_BY_ID_WITH_USER_DATA_SUCCESS,
  props<{ payload: RoomExtendedInterface }>()
);

export const fillRoomByIdWithUserDataFailureAction = createAction(
  ActionTypes.FILL_ROOM_BY_ID_WITH_USER_DATA_FAILURE,
  props<{ error: ErrorInterface }>()
);

// Fill Room By Id With Messages Actions
export const fillRoomByIdWithMessagesSuccessAction = createAction(
  ActionTypes.FILL_ROOM_BY_ID_WITH_MESSAGES_SUCCESS,
  props<{ payload: RoomExtendedInterface }>()
);

export const fillRoomByIdWithMessagesFailureAction = createAction(
  ActionTypes.FILL_ROOM_BY_ID_WITH_MESSAGES_FAILURE,
  props<{ error: ErrorInterface }>()
);

// Get Room Actions
export const getRoomAction = createAction(
  ActionTypes.GET_ROOM,
  // TODO: Create interface for this request
  props<{ currentUserId: string; userId: string }>()
);

export const getRoomSuccessAction = createAction(
  ActionTypes.GET_ROOM_SUCCESS,
  props<{ payload: RoomExtendedInterface }>()
);

export const getRoomFailureAction = createAction(
  ActionTypes.GET_ROOM_FAILURE,
  props<{ error: ErrorInterface }>()
);

// Create Room Actions
export const createRoomAction = createAction(
  ActionTypes.CREATE_ROOM,
  // TODO: Create interface for this request
  props<{ currentUserId: string; userId: string }>()
);

export const createRoomSuccessAction = createAction(
  ActionTypes.CREATE_ROOM_SUCCESS,
  props<{ payload: RoomExtendedInterface }>()
);

export const createRoomFailureAction = createAction(
  ActionTypes.CREATE_ROOM_FAILURE,
  props<{ error: ErrorInterface }>()
);

// // Fill Room With User Data Actions
// export const fillRoomWithUserDataSuccessAction = createAction(
//   ActionTypes.FILL_ROOM_WITH_USER_DATA_SUCCESS,
//   props<{ payload: RoomExtendedInterface }>()
// );

// export const fillRoomWithUserDataFailureAction = createAction(
//   ActionTypes.FILL_ROOM_WITH_USER_DATA_FAILURE,
//   props<{ error: ErrorInterface }>()
// );

// // Fill Room With Messages Actions
// export const fillRoomWithMessagesSuccessAction = createAction(
//   ActionTypes.FILL_ROOM_WITH_MESSAGES_SUCCESS,
//   props<{ payload: RoomExtendedInterface }>()
// );

// export const fillRoomWithMessagesFailureAction = createAction(
//   ActionTypes.FILL_ROOM_WITH_MESSAGES_FAILURE,
//   props<{ error: ErrorInterface }>()
// );
