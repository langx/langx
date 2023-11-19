import { Action, createReducer, on } from '@ngrx/store';

import { MessageStateInterface } from 'src/app/models/types/states/messageState.interface';
import { logoutSuccessAction } from '../actions/auth.action';
import {
  getRoomByIdAction,
  getRoomByIdFailureAction,
  getRoomByIdSuccessAction,
} from 'src/app/store/actions/room.action';
import {
  activateRoomAction,
  deactivateRoomAction,
  createMessageAction,
  createMessageFailureAction,
  createMessageSuccessAction,
  getMessagesAction,
  getMessagesFailureAction,
  getMessagesSuccessAction,
  getMessagesWithOffsetAction,
  getMessagesWithOffsetFailureAction,
  getMessagesWithOffsetSuccessAction,
} from 'src/app/store/actions/message.action';

const initialState: MessageStateInterface = {
  isLoading: false,
  room: null,
  error: null,
};

const messageReducer = createReducer(
  initialState,
  // Get Messages Reducers
  on(
    getMessagesAction,
    (state): MessageStateInterface => ({
      ...state,
      isLoading: true,
      error: null,
    })
  ),
  on(
    getMessagesSuccessAction,
    (state, action): MessageStateInterface => ({
      ...state,
      isLoading: false,
      room: {
        ...state.room,
        total: action.payload?.total,
        messages: action.payload?.documents,
      },
    })
  ),
  on(
    getMessagesFailureAction,
    (state, action): MessageStateInterface => ({
      ...state,
      isLoading: false,
      error: action.error,
    })
  ),
  on(
    getMessagesWithOffsetAction,
    (state): MessageStateInterface => ({
      ...state,
      isLoading: true,
      error: null,
    })
  ),
  on(
    getMessagesWithOffsetSuccessAction,
    (state, action): MessageStateInterface => ({
      ...state,
      isLoading: false,
      room: {
        ...state.room,
        total: action.payload?.total,
        messages: [...action.payload?.documents, ...state.room.messages],
      },
    })
  ),
  on(
    getMessagesWithOffsetFailureAction,
    (state, action): MessageStateInterface => ({
      ...state,
      isLoading: false,
      error: action.error,
    })
  ),
  on(
    createMessageAction,
    (state): MessageStateInterface => ({
      ...state,
      isLoading: true,
      error: null,
    })
  ),
  on(
    createMessageSuccessAction,
    (state, action): MessageStateInterface => ({
      ...state,
      isLoading: false,
      room: {
        ...state.room,
        messages: [...state.room.messages, action.payload],
      },
    })
  ),
  on(
    createMessageFailureAction,
    (state, action): MessageStateInterface => ({
      ...state,
      isLoading: false,
      error: action.error,
    })
  ),
  // Get Room By Id Reducers for only loader & error
  on(
    getRoomByIdAction,
    (state): MessageStateInterface => ({
      ...state,
      isLoading: true,
    })
  ),
  on(
    getRoomByIdSuccessAction,
    (state): MessageStateInterface => ({
      ...state,
      isLoading: false,
    })
  ),
  on(
    getRoomByIdFailureAction,
    (state, action): MessageStateInterface => ({
      ...state,
      isLoading: false,
      error: action.error,
    })
  ),
  // Activate Room Reducers
  on(
    activateRoomAction,
    (state, action): MessageStateInterface => ({
      ...state,
      room: action.payload,
    })
  ),
  on(
    deactivateRoomAction,
    (state): MessageStateInterface => ({
      ...state,
      room: null,
    })
  ),
  // Clear After Logout Success Action
  on(
    logoutSuccessAction,
    (): MessageStateInterface => ({
      ...initialState,
    })
  )
);

export function messageReducers(state: MessageStateInterface, action: Action) {
  return messageReducer(state, action);
}
