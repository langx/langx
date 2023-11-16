import { Action, createReducer, on } from '@ngrx/store';

import { MessageStateInterface } from 'src/app/models/types/states/messageState.interface';
import {
  activateRoomAction,
  deactivateRoomAction,
  getRoomByIdAction,
  getRoomByIdFailureAction,
  getRoomByIdSuccessAction,
} from '../actions/room.action';
import {
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
  messages: null,
  userData: null,
  total: null,
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
      total: action.payload?.total,
      messages: action.payload?.documents,
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
      total: action.payload?.total,
      messages: [...action.payload?.documents, ...state.messages],
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
      messages: [...state.messages, action.payload],
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
  // Get Room By Id Reducers
  // on(
  //   getRoomByIdAction,
  //   (state): MessageStateInterface => ({
  //     ...state,
  //     isLoading: true,
  //     error: null,
  //     messages: null,
  //     total: null,
  //     userData: null,
  //   })
  // ),
  // on(
  //   getRoomByIdSuccessAction,
  //   (state, action): MessageStateInterface => ({
  //     ...state,
  //     isLoading: false,
  //     messages: action.payload.messages,
  //     total: action.payload.total,
  //     userData: action.payload.userData,
  //   })
  // ),
  // on(
  //   getRoomByIdFailureAction,
  //   (state, action): MessageStateInterface => ({
  //     ...state,
  //     isLoading: false,
  //     error: action.error,
  //   })
  // ),
  // Activate/Deactivate Room Reducers
  on(
    activateRoomAction,
    (state, action): MessageStateInterface => ({
      ...state,
      messages: action.payload.messages,
      total: action.payload.total,
      userData: action.payload.userData,
    })
  ),
  on(
    deactivateRoomAction,
    (state): MessageStateInterface => ({
      ...state,
      messages: null,
      total: null,
      userData: null,
    })
  )
);

export function messageReducers(state: MessageStateInterface, action: Action) {
  return messageReducer(state, action);
}
