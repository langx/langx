import { Action, createReducer, on } from '@ngrx/store';

import { RoomStateInterface } from 'src/app/models/types/states/roomState.interface';
import {
  createRoomAction,
  createRoomFailureAction,
  createRoomSuccessAction,
  getRoomAction,
  getRoomFailureAction,
  getRoomSuccessAction,
  getRoomsAction,
  getRoomsFailureAction,
  getRoomsSuccessAction,
  getRoomsWithOffsetAction,
  getRoomsWithOffsetFailureAction,
  getRoomsWithOffsetSuccessAction,
  selectRoomAction,
} from 'src/app/store/actions/room.action';

const initialState: RoomStateInterface = {
  isLoading: false,
  room: null,
  rooms: null,
  total: null,
  error: null,
};

const roomReducer = createReducer(
  initialState,
  // Get Room Reducers
  on(
    getRoomAction,
    (state): RoomStateInterface => ({
      ...state,
      isLoading: true,
      error: null,
      room: null,
    })
  ),
  on(
    getRoomSuccessAction,
    (state, action): RoomStateInterface => ({
      ...state,
      isLoading: false,
      room: action.payload,
    })
  ),
  on(
    getRoomFailureAction,
    (state, action): RoomStateInterface => ({
      ...state,
      isLoading: false,
      error: action.error,
    })
  ),
  // Create Room Reducers
  on(
    createRoomAction,
    (state): RoomStateInterface => ({
      ...state,
      isLoading: true,
      error: null,
    })
  ),
  on(
    createRoomSuccessAction,
    (state, action): RoomStateInterface => ({
      ...state,
      isLoading: false,
      room: action.payload,
    })
  ),
  on(
    createRoomFailureAction,
    (state, action): RoomStateInterface => ({
      ...state,
      isLoading: false,
      error: action.error,
    })
  ),
  // Select Room Reducers
  on(
    selectRoomAction,
    (state, action): RoomStateInterface => ({
      ...state,
      room: action.payload,
    })
  ),
  // Get Rooms Reducers
  on(
    getRoomsAction,
    (state): RoomStateInterface => ({
      ...state,
      isLoading: true,
      error: null,
    })
  ),
  on(
    getRoomsSuccessAction,
    (state, action): RoomStateInterface => ({
      ...state,
      isLoading: false,
      total: action.payload?.total,
      rooms: action.payload?.documents,
    })
  ),
  on(
    getRoomsFailureAction,
    (state, action): RoomStateInterface => ({
      ...state,
      isLoading: false,
      error: action.error,
    })
  ),
  on(
    getRoomsWithOffsetAction,
    (state): RoomStateInterface => ({
      ...state,
      isLoading: true,
      error: null,
    })
  ),
  on(
    getRoomsWithOffsetSuccessAction,
    (state, action): RoomStateInterface => ({
      ...state,
      isLoading: false,
      total: action.payload?.total,
      rooms: [...state.rooms, ...action.payload?.documents],
    })
  ),
  on(
    getRoomsWithOffsetFailureAction,
    (state, action): RoomStateInterface => ({
      ...state,
      isLoading: false,
      error: action.error,
    })
  )
);

export function roomReducers(state: RoomStateInterface, action: Action) {
  return roomReducer(state, action);
}
