import { Action, createReducer, on } from '@ngrx/store';

import { Message } from 'src/app/models/Message';
import { MessageStateInterface } from 'src/app/models/types/states/messageState.interface';
import {
  deleteAccountSuccessAction,
  logoutSuccessAction,
} from 'src/app/store/actions/auth.action';
import {
  findActiveRoomAndAddMessageAction,
  findActiveRoomAndDeleteMessageAction,
  findActiveRoomAndUpdateMessageAction,
  findAndUpdateActiveRoomUpdatedAtAction,
} from 'src/app/store/actions/notification.action';
import {
  activateRoomAction,
  deactivateRoomAction,
  createMessageAction,
  createMessageFailureAction,
  createMessageSuccessAction,
  getMessagesWithOffsetAction,
  getMessagesWithOffsetFailureAction,
  getMessagesWithOffsetSuccessAction,
  updateMessageAction,
  updateMessageSuccessAction,
  updateMessageFailureAction,
  deleteMessageAction,
  deleteMessageSuccessAction,
  deleteMessageFailureAction,
  clearErrorsAction,
} from 'src/app/store/actions/message.action';

const initialState: MessageStateInterface = {
  isLoading: false,
  isLoading_offset: false,
  room: null,
  error: null,
};

const messageReducer = createReducer(
  initialState,

  // Get Messages With Offset Reducers
  on(
    getMessagesWithOffsetAction,
    (state): MessageStateInterface => ({
      ...state,
      isLoading_offset: true,
      error: null,
    })
  ),
  on(
    getMessagesWithOffsetSuccessAction,
    (state, action): MessageStateInterface => ({
      ...state,
      isLoading_offset: false,
      room: {
        ...state.room,
        total: action.payload?.total,
        messages: [...action.payload?.documents, ...state.room?.messages],
      },
    })
  ),
  on(
    getMessagesWithOffsetFailureAction,
    (state, action): MessageStateInterface => ({
      ...state,
      isLoading_offset: false,
      error: action.error,
    })
  ),
  on(createMessageAction, (state, action): MessageStateInterface => {
    console.log(action.request);

    // Create a new Message object from action.request
    const newMessage: Message = {
      // Assuming these are the properties of Message
      $collectionId: null,
      $createdAt: null,
      $databaseId: null,
      $permissions: null,
      $updatedAt: null,
      seen: false,
      sender: action.currentUserId,
      $id: action.request.$id,
      to: action.request.to,
      roomId: action.request.roomId,
      replyTo: action.request.replyTo,
      type: action.request.type,
      body: action.request.body,
      imageId: action.request.imageId,
      audioId: action.request.audioId,
    };

    return {
      ...state,
      isLoading: true,
      error: null,
      room: {
        ...state.room,
        messages: [...(state.room?.messages || []), newMessage],
      },
    };
  }),
  on(createMessageSuccessAction, (state, action): MessageStateInterface => {
    // Check if a message with the same $id already exists
    const messageExists = state.room?.messages?.some(
      (msg) => msg.$id === action.payload.$id
    );

    return {
      ...state,
      isLoading: false,
      room: {
        ...state.room,
        // If the message does not exist, add it to messages
        messages: messageExists
          ? state.room.messages
          : [...(state.room.messages || []), action.payload],
      },
    };
  }),
  on(
    createMessageFailureAction,
    (state, action): MessageStateInterface => ({
      ...state,
      isLoading: false,
      error: action.error,
    })
  ),

  // Delete Message Reducers
  on(
    deleteMessageAction,
    (state): MessageStateInterface => ({
      ...state,
      isLoading: true,
      error: null,
    })
  ),
  // on(deleteMessageSuccessAction, (state, action): MessageStateInterface => {
  //   const updatedMessages = state.room?.messages.filter(
  //     (msg) => msg.$id !== action.payload.$id
  //   );
  //   return {
  //     ...state,
  //     isLoading: false,
  //     room: {
  //       ...state.room,
  //       messages: updatedMessages,
  //     },
  //   };
  // }),
  on(
    deleteMessageFailureAction,
    (state, action): MessageStateInterface => ({
      ...state,
      isLoading: false,
      error: action.error,
    })
  ),
  on(
    findActiveRoomAndDeleteMessageAction,
    (state, action): MessageStateInterface => {
      // Check if there is any room in the state
      if (!state.room) return { ...state };

      // Check if the message belongs to the active room
      if (state.room?.$id !== action.payload.roomId.$id) return { ...state };

      const updatedMessages = state.room?.messages.filter(
        (msg) => msg.$id !== action.payload.$id
      );
      return {
        ...state,
        room: {
          ...state.room,
          messages: updatedMessages,
        },
      };
    }
  ),

  // Update Message Reducers
  on(
    updateMessageAction,
    (state): MessageStateInterface => ({
      ...state,
      error: null,
    })
  ),
  on(
    updateMessageSuccessAction,
    (state, action): MessageStateInterface => ({
      ...state,
      // Only update after notification came, not here !
      room: {
        ...state.room,
        messages: state.room?.messages.map((msg) => {
          if (msg.$id === action.payload.$id) {
            return { ...msg, seen: true };
          }
          return msg;
        }),
      },
    })
  ),
  on(
    updateMessageFailureAction,
    (state, action): MessageStateInterface => ({
      ...state,
      error: action.error,
    })
  ),

  // Find And Update Active Room Reduce
  on(
    findAndUpdateActiveRoomUpdatedAtAction,
    (state, action): MessageStateInterface => {
      // Check if the room id matches the action payload id
      if (state.room?.$id === action.payload.$id) {
        // If it matches, return a new state with the updated room
        return {
          ...state,
          room: { ...state.room, $updatedAt: action.payload.$updatedAt },
        };
      }
      return state;
    }
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

  // Find And Update Active Room Message Reducers
  on(
    findActiveRoomAndAddMessageAction,
    (state, action): MessageStateInterface => {
      // Check if there is any room in the state
      if (!state.room) return { ...state };

      // Check if the message belongs to the active room
      if (state.room?.$id !== action.payload.roomId.$id) return { ...state };

      // Check if the message already exists in the room
      if (
        state.room?.messages &&
        state.room?.messages.some((msg) => msg.$id === action.payload.$id)
      ) {
        // If the message already exists, update it
        return {
          ...state,
          room: {
            ...state.room,
            messages: state.room.messages.map((msg) =>
              msg.$id === action.payload.$id
                ? { ...action.payload, roomId: action.payload.roomId.$id }
                : msg
            ),
          },
        };
      }

      // If the message does not exist, add it to the room
      const payload: Message = {
        ...action.payload,
        roomId: action.payload.roomId.$id,
      };

      return {
        ...state,
        room: {
          ...state.room,
          messages: [...(state.room?.messages || []), payload],
        },
      };
    }
  ),
  on(
    findActiveRoomAndUpdateMessageAction,
    (state, action): MessageStateInterface => {
      // Check if there is any room in the state
      if (!state.room) return { ...state };

      // Check if the message belongs to the active room
      if (state.room?.$id !== action.payload.roomId.$id) return { ...state };

      // Create a new payload with roomId as a string
      const payload: Message = {
        ...action.payload,
        roomId: action.payload.roomId.$id,
      };

      return {
        ...state,
        room: {
          ...state.room,
          messages: state.room?.messages.map((msg) => {
            if (msg.$id === payload.$id) {
              return { ...msg, ...payload };
            }
            return msg;
          }),
        },
      };
    }
  ),

  // Set initialState after Logout/Delete Success Action
  on(
    logoutSuccessAction,
    deleteAccountSuccessAction,
    (): MessageStateInterface => ({
      ...initialState,
    })
  ),

  // Clear Errors Actions
  on(
    clearErrorsAction,
    (state): MessageStateInterface => ({
      ...state,
      isLoading: false,
      error: null,
    })
  )
);

export function messageReducers(state: MessageStateInterface, action: Action) {
  return messageReducer(state, action);
}
