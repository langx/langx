import { Action, createReducer, on } from '@ngrx/store';

import { RoomsStateInterface } from 'src/app/models/types/states/roomsState.interface';
import {
  getRoomsAction,
  getRoomsFailureAction,
  getRoomsSuccessAction,
  getRoomsWithOffsetAction,
  getRoomsWithOffsetFailureAction,
  getRoomsWithOffsetSuccessAction,
} from 'src/app/store/actions/rooms.action';
import {
  createRoomAction,
  createRoomFailureAction,
  createRoomSuccessAction,
  getRoomByIdAction,
  getRoomByIdFailureAction,
  getRoomByIdSuccessAction,
  getRoomAction,
  getRoomFailureAction,
  getRoomSuccessAction,
  selectRoomAction,
} from 'src/app/store/actions/room.action';

const initialState: RoomsStateInterface = {
  isLoading: false,
  room: null,
  rooms: null,
  total: null,
  error: null,
};

const roomsReducer = createReducer(
  initialState,
  // Get Rooms Reducers
  on(
    getRoomsAction,
    (state): RoomsStateInterface => ({
      ...state,
      isLoading: true,
      error: null,
    })
  ),
  on(
    getRoomsSuccessAction,
    (state, action): RoomsStateInterface => ({
      ...state,
      isLoading: false,
      total: action.payload?.total,
      rooms: action.payload?.documents,
    })
  ),
  on(
    getRoomsFailureAction,
    (state, action): RoomsStateInterface => ({
      ...state,
      isLoading: false,
      error: action.error,
    })
  ),
  on(
    getRoomsWithOffsetAction,
    (state): RoomsStateInterface => ({
      ...state,
      isLoading: true,
      error: null,
    })
  ),
  on(
    getRoomsWithOffsetSuccessAction,
    (state, action): RoomsStateInterface => ({
      ...state,
      isLoading: false,
      total: action.payload?.total,
      rooms: [...state.rooms, ...action.payload?.documents],
    })
  ),
  on(
    getRoomsWithOffsetFailureAction,
    (state, action): RoomsStateInterface => ({
      ...state,
      isLoading: false,
      error: action.error,
    })
  ),
  // Get Room By Id Reducers
  on(
    getRoomByIdAction,
    (state): RoomsStateInterface => ({
      ...state,
      isLoading: true,
      error: null,
      room: null,
    })
  ),
  on(
    getRoomByIdSuccessAction,
    (state, action): RoomsStateInterface => ({
      ...state,
      isLoading: false,
      room: action.payload,
    })
  ),
  on(
    getRoomByIdFailureAction,
    (state, action): RoomsStateInterface => ({
      ...state,
      isLoading: false,
      error: action.error,
    })
  ),
  // Get Room Reducers
  on(
    getRoomAction,
    (state): RoomsStateInterface => ({
      ...state,
      isLoading: true,
      error: null,
      room: null,
    })
  ),
  on(
    getRoomSuccessAction,
    (state, action): RoomsStateInterface => ({
      ...state,
      isLoading: false,
      room: action.payload,
    })
  ),
  on(
    getRoomFailureAction,
    (state, action): RoomsStateInterface => ({
      ...state,
      isLoading: false,
      error: action.error,
    })
  ),
  // Create Room Reducers
  on(
    createRoomAction,
    (state): RoomsStateInterface => ({
      ...state,
      isLoading: true,
      error: null,
    })
  ),
  on(
    createRoomSuccessAction,
    (state, action): RoomsStateInterface => ({
      ...state,
      isLoading: false,
      room: action.payload,
    })
  ),
  on(
    createRoomFailureAction,
    (state, action): RoomsStateInterface => ({
      ...state,
      isLoading: false,
      error: action.error,
    })
  ),
  // Select Room Reducers
  on(
    selectRoomAction,
    (state, action): RoomsStateInterface => ({
      ...state,
      room: action.payload,
    })
  )
);

export function roomsReducers(state: RoomsStateInterface, action: Action) {
  return roomsReducer(state, action);
}
