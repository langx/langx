import { Action, createReducer, on } from '@ngrx/store';

import { RoomStateInterface } from 'src/app/models/types/states/roomState.interface';
import {
  getMessagesAction,
  getMessagesFailureAction,
  getMessagesSuccessAction,
  getMessagesWithOffsetAction,
  getMessagesWithOffsetFailureAction,
  getMessagesWithOffsetSuccessAction,
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
  error_rooms: null,
  room: null,
  messages: null,
  total_messages: null,
  error_messages: null,
};

const roomReducer = createReducer(
  initialState,
  // Get Rooms Reducers
  on(
    getRoomsAction,
    (state): RoomStateInterface => ({
      ...state,
      isLoading: true,
      error_rooms: null,
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
      error_rooms: action.error,
    })
  ),
  on(
    getRoomsWithOffsetAction,
    (state): RoomStateInterface => ({
      ...state,
      isLoading: true,
      error_rooms: null,
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
      error_rooms: action.error,
    })
  ),
  // Get Messages Reducers
  on(
    getMessagesAction,
    (state): RoomStateInterface => ({
      ...state,
      isLoading: true,
      error_messages: null,
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
      error_messages: action.error,
    })
  ),
  on(
    getMessagesWithOffsetAction,
    (state): RoomStateInterface => ({
      ...state,
      isLoading: true,
      error_messages: null,
    })
  ),
  on(
    getMessagesWithOffsetSuccessAction,
    (state, action): RoomStateInterface => ({
      ...state,
      isLoading: false,
      total_messages: action.payload?.total,
      messages: [...action.payload?.documents, ...state.messages],
    })
  ),
  on(
    getMessagesWithOffsetFailureAction,
    (state, action): RoomStateInterface => ({
      ...state,
      isLoading: false,
      error_messages: action.error,
    })
  )
);

export function roomReducers(state: RoomStateInterface, action: Action) {
  return roomReducer(state, action);
}
