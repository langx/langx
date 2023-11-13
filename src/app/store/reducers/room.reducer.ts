import { Action, createReducer, on } from '@ngrx/store';

import { RoomStateInterface } from 'src/app/models/types/states/roomState.interface';
import {
  getMessagesAction,
  getMessagesFailureAction,
  getMessagesSuccessAction,
  getRoomsAction,
  getRoomsFailureAction,
  getRoomsSuccessAction,
  getRoomsWithOffsetAction,
  getRoomsWithOffsetFailureAction,
  getRoomsWithOffsetSuccessAction,
} from 'src/app/store/actions/room.action';

const initialState: RoomStateInterface = {
  isLoading: false,
  rooms: null,
  total_rooms: null,
  room: null,
  messages: null,
  total_messages: null,
  error: null,
};

const roomReducer = createReducer(
  initialState,
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
      total_rooms: action.payload?.total,
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
      total_rooms: action.payload?.total,
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
  ),
  // Get Messages Reducers
  on(
    getMessagesAction,
    (state): RoomStateInterface => ({
      ...state,
      isLoading: true,
      error: null,
    })
  ),
  on(
    getMessagesSuccessAction,
    (state, action): RoomStateInterface => ({
      ...state,
      isLoading: false,
      total_messages: action.payload?.total,
      messages: action.payload?.documents,
    })
  ),
  on(
    getMessagesFailureAction,
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
