import { Action, createReducer, on } from '@ngrx/store';

import { Message } from 'src/app/models/Message';
import { MessageStateInterface } from 'src/app/models/types/states/messageState.interface';
import { logoutSuccessAction } from '../actions/auth.action';
import {
  findActiveRoomAndAddMessageAction,
  findActiveRoomAndUpdateMessageSeenAction,
} from 'src/app/store/actions/notification.action';
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
  updateMessageSeenAction,
  updateMessageSeenSuccessAction,
  updateMessageSeenFailureAction,
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
      // TODO: Here we need to update the room messages
      // To show user loading icon
      // room: {
      //   ...state.room,
      //   // messages: [...state.room.messages, action.payload],
      //},
      isLoading: true,
      error: null,
    })
  ),
  on(
    createMessageSuccessAction,
    (state): MessageStateInterface => ({
      ...state,
      isLoading: false,
    })
  ),
  on(
    createMessageFailureAction,
    (state, action): MessageStateInterface => ({
      ...state,
      // TODO: Here we need to update the room messages
      // To show user failed icon
      // room: {
      //   ...state.room,
      //   // messages: [...state.room.messages, action.payload],
      // },
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

  // Update Message Reducers
  on(
    updateMessageSeenAction,
    (state): MessageStateInterface => ({
      ...state,
      error: null,
    })
  ),
  on(
    updateMessageSeenSuccessAction,
    (state, action): MessageStateInterface => ({
      ...state,
      // Only update after notification came, not here !
      room: {
        ...state.room,
        messages: state.room.messages.map((msg) => {
          if (msg.$id === action.payload.$id) {
            return { ...msg, seen: true };
          }
          return msg;
        }),
      },
    })
  ),
  on(
    updateMessageSeenFailureAction,
    (state, action): MessageStateInterface => ({
      ...state,
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
  ),

  // Find And Update Active Room Message Reducers
  on(
    findActiveRoomAndAddMessageAction,
    (state, action): MessageStateInterface => {
      // Check if there is any room in the state
      if (!state.room) return { ...state };

      // Check if the message belongs to the active room
      if (state.room.$id !== action.payload.roomId.$id) return { ...state };

      // Check if the message already exists in the room
      if (
        state.room.messages &&
        state.room.messages.some((msg) => msg.$id === action.payload.$id)
      )
        return { ...state };

      // Return the new state
      const payload: Message = {
        ...action.payload,
        roomId: action.payload.roomId.$id,
      };

      return {
        ...state,
        room: {
          ...state.room,
          messages: [...(state.room.messages || []), payload],
        },
      };

      // Sort rooms by $updatedAt in descending order
      // const sortedRooms = updatedRooms.sort(
      //   (a, b) =>
      //     new Date(b.$updatedAt).getTime() - new Date(a.$updatedAt).getTime()
      // );
      // // Return the new state
      // return { ...state, rooms: sortedRooms };
    }
  ),
  on(
    findActiveRoomAndUpdateMessageSeenAction,
    (state, action): MessageStateInterface => {
      // Check if there is any room in the state
      if (!state.room) return { ...state };

      // Check if the message belongs to the active room
      if (state.room.$id !== action.payload.roomId.$id) return { ...state };

      // Return the new state
      const payload: Message = {
        ...action.payload,
        roomId: action.payload.roomId.$id,
      };

      return {
        ...state,
        room: {
          ...state.room,
          messages: state.room.messages.map((msg) => {
            if (msg.$id === action.payload.$id) {
              return { ...msg, seen: true };
            }
            return msg;
          }),
        },
      };
    }
  )
);

export function messageReducers(state: MessageStateInterface, action: Action) {
  return messageReducer(state, action);
}
