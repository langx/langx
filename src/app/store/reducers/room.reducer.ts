import { Action, createReducer, on } from '@ngrx/store';

import { RoomStateInterface } from 'src/app/models/types/states/roomState.interface';
import {
  createMessageAction,
  createMessageFailureAction,
  createMessageSuccessAction,
  createRoomAction,
  createRoomFailureAction,
  createRoomSuccessAction,
  getMessagesAction,
  getMessagesFailureAction,
  getMessagesSuccessAction,
  getMessagesWithOffsetAction,
  getMessagesWithOffsetFailureAction,
  getMessagesWithOffsetSuccessAction,
  getRoomAction,
  getRoomFailureAction,
  getRoomSuccessAction,
  getRoomsAction,
  getRoomsFailureAction,
  getRoomsSuccessAction,
  getRoomsWithOffsetAction,
  getRoomsWithOffsetFailureAction,
  getRoomsWithOffsetSuccessAction,
} from 'src/app/store/actions/room.action';

const initialState: RoomStateInterface = {
  isLoading: false,
  room: null,
  rooms: null,
  total_rooms: null,
  error_rooms: null,
  messages: null,
  total_messages: null,
  error_messages: null,
};

const roomReducer = createReducer(
  initialState,
  on(
    getRoomAction,
    (state): RoomStateInterface => ({
      ...state,
      isLoading: true,
      error_rooms: null,
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
      error_rooms: action.error,
    })
  ),
  on(
    createRoomAction,
    (state): RoomStateInterface => ({
      ...state,
      isLoading: true,
      error_rooms: null,
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
      error_rooms: action.error,
    })
  ),
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
  ),
  on(
    createMessageAction,
    (state): RoomStateInterface => ({
      ...state,
      isLoading: true,
      error_messages: null,
    })
  ),
  on(
    createMessageSuccessAction,
    (state, action): RoomStateInterface => ({
      ...state,
      isLoading: false,
      messages: [...state.messages, action.payload],
    })
  ),
  on(
    createMessageFailureAction,
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
