import { Action, createReducer, on } from '@ngrx/store';

// Interface Imports
import { Message } from 'src/app/models/Message';
import { RoomStateInterface } from 'src/app/models/types/states/roomState.interface';

// Action Imports
import { deactivateRoomAction } from 'src/app/store/actions/message.action';
import {
  deleteAccountSuccessAction,
  logoutSuccessAction,
} from 'src/app/store/actions/auth.action';
import {
  getRoomsAction,
  getRoomsSuccessAction,
  getRoomsFailureAction,
  getRoomsWithOffsetAction,
  getRoomsWithOffsetSuccessAction,
  getRoomsWithOffsetFailureAction,
} from 'src/app/store/actions/rooms.action';
import {
  createRoomAction,
  createRoomFailureAction,
  createRoomSuccessAction,
  getRoomAction,
  getRoomFailureAction,
  getRoomSuccessAction,
  getRoomByIdAction,
  getRoomByIdFailureAction,
  getRoomByIdSuccessAction,
  createRoomInitialStateAction,
  clearErrorsAction,
} from 'src/app/store/actions/room.action';
import {
  findRoomAndAddMessageAction,
  findAndUpdateRoomUpdatedAtAction,
  findOrAddRoomAction,
  findOrAddRoomSuccessAction,
  findOrAddRoomFailureAction,
  findRoomAndUpdateMessageAction,
  findRoomAndDeleteMessageAction,
} from 'src/app/store/actions/notification.action';

const initialState: RoomStateInterface = {
  isLoading: false,
  total: null,
  rooms: null,
  error: null,
  createRoomError: null,
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
  ),

  // Get Room Reducers
  on(
    getRoomAction,
    (state): RoomStateInterface => ({
      ...state,
      isLoading: true,
      error: null,
    })
  ),
  on(
    getRoomSuccessAction,
    (state, action): RoomStateInterface => ({
      ...state,
      isLoading: false,
      rooms: [action.payload, ...(state.rooms || [])],
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
  on(createRoomSuccessAction, (state, action): RoomStateInterface => {
    const updatedRooms = state.rooms ? [...state.rooms] : [];
    const roomIndex = updatedRooms.findIndex(
      (room) => room.$id === action.payload.$id
    );

    if (roomIndex !== -1) {
      // If room exists, update it
      updatedRooms[roomIndex] = action.payload;
    } else {
      // If room does not exist, add it
      updatedRooms.push(action.payload);
    }

    return {
      ...state,
      isLoading: false,
      rooms: updatedRooms,
    };
  }),
  on(
    createRoomFailureAction,
    (state, action): RoomStateInterface => ({
      ...state,
      isLoading: false,
      createRoomError: action.error,
    })
  ),
  on(
    createRoomInitialStateAction,
    (state): RoomStateInterface => ({
      ...state,
      createRoomError: null,
    })
  ),

  // Get Room By Id Reducers
  on(
    getRoomByIdAction,
    (state): RoomStateInterface => ({
      ...state,
      isLoading: true,
      error: null,
    })
  ),
  on(getRoomByIdSuccessAction, (state, action): RoomStateInterface => {
    const updatedRooms = state.rooms ? [...state.rooms] : [];
    const roomIndex = updatedRooms.findIndex(
      (room) => room.$id === action.payload.$id
    );

    if (roomIndex !== -1) {
      updatedRooms[roomIndex] = action.payload;
    } else {
      updatedRooms.unshift(action.payload);
    }

    return {
      ...state,
      isLoading: false,
      rooms: updatedRooms,
    };
  }),
  on(
    getRoomByIdFailureAction,
    (state, action): RoomStateInterface => ({
      ...state,
      isLoading: false,
      error: action.error,
    })
  ),

  // Deactivate Room Reducers
  on(deactivateRoomAction, (state, action): RoomStateInterface => {
    return {
      ...state,
      rooms: state.rooms.map((room) =>
        room.$id === action.payload.$id ? action.payload : room
      ),
    };
  }),

  // Find And Update Room Reducer
  on(findAndUpdateRoomUpdatedAtAction, (state, action): RoomStateInterface => {
    // Create a new array with the updated room
    const updatedRooms = state.rooms?.map((room) =>
      room.$id === action.payload.$id
        ? { ...room, $updatedAt: action.payload.$updatedAt }
        : room
    );

    // Sort rooms by $updatedAt in descending order
    const sortedRooms = updatedRooms?.sort(
      (a, b) =>
        new Date(b.$updatedAt).getTime() - new Date(a.$updatedAt).getTime()
    );
    // Return the new state
    return { ...state, rooms: sortedRooms };
  }),

  // Find And Update Room Message Reducer
  on(findRoomAndAddMessageAction, (state, action): RoomStateInterface => {
    // Create a new array with the updated room
    const updatedRooms = state.rooms?.map((room) => {
      const payload: Message = {
        ...action.payload,
        roomId: action.payload.roomId.$id,
      };

      if (room.$id === action.payload.roomId.$id) {
        // Check if the message already exists in the room
        const messageIndex = room.messages?.findIndex(
          (message) => message.$id === payload.$id
        );

        let newMessages = room.messages || [];

        if (messageIndex !== undefined && messageIndex > -1) {
          // If the message exists, replace it
          newMessages = [
            ...newMessages.slice(0, messageIndex),
            payload,
            ...newMessages.slice(messageIndex + 1),
          ];
        } else {
          // If the message does not exist, add it
          newMessages = [...newMessages, payload];
        }

        return {
          ...room,
          messages: newMessages,
        };
      }

      return room;
    });

    // Sort rooms by $updatedAt in descending order
    const sortedRooms = updatedRooms?.sort(
      (a, b) =>
        new Date(b.$updatedAt).getTime() - new Date(a.$updatedAt).getTime()
    );

    // Return the new state
    return { ...state, rooms: sortedRooms };
  }),

  on(findRoomAndUpdateMessageAction, (state, action): RoomStateInterface => {
    // Find the room with the matching roomId
    const roomIndex = state.rooms?.findIndex(
      (room) => room.$id === action.payload.roomId.$id
    );

    if (roomIndex === undefined || roomIndex === -1) {
      // If the room is not found, return the state unchanged
      return state;
    }

    // Create a new array with the updated message
    const updatedMessages = state.rooms[roomIndex].messages?.map((message) =>
      message.$id === action.payload.$id
        ? { ...message, ...action.payload, roomId: action.payload.roomId.$id }
        : message
    );

    // Create a new room with the updated messages
    const updatedRoom = {
      ...state.rooms[roomIndex],
      messages: updatedMessages,
    };

    // Create a new array with the updated room
    const updatedRooms = [
      ...state.rooms.slice(0, roomIndex),
      updatedRoom,
      ...state.rooms.slice(roomIndex + 1),
    ];

    // Sort rooms by $updatedAt in descending order
    const sortedRooms = updatedRooms.sort(
      (a, b) =>
        new Date(b.$updatedAt).getTime() - new Date(a.$updatedAt).getTime()
    );

    // Return the new state
    return { ...state, rooms: sortedRooms };
  }),

  // Find Room And Delete Message Reducer
  on(findRoomAndDeleteMessageAction, (state, action): RoomStateInterface => {
    // Create a new array with the updated room
    const updatedRooms = state.rooms?.map((room) => {
      const updatedMessages = room.messages?.filter(
        (message) => message.$id !== action.payload.$id
      );

      return room.$id === action.payload.roomId.$id
        ? {
            ...room,
            messages: updatedMessages,
          }
        : room;
    });

    // Sort rooms by $updatedAt in descending order
    const sortedRooms = updatedRooms?.sort(
      (a, b) =>
        new Date(b.$updatedAt).getTime() - new Date(a.$updatedAt).getTime()
    );
    // Return the new state
    return { ...state, rooms: sortedRooms };
  }),

  // Find Or Add Room Reducer
  on(
    findOrAddRoomAction,
    (state): RoomStateInterface => ({
      ...state,
      isLoading: true,
      error: null,
    })
  ),
  on(findOrAddRoomSuccessAction, (state, action): RoomStateInterface => {
    // Check if the room already exists
    const roomExists = state.rooms?.find(
      (room) => room.$id === action.payload.$id
    );

    // If the room already exists, return the state
    if (roomExists) return { ...state };

    // If the room doesn't exist, add the room to the state
    const updatedRooms = [action.payload, ...(state.rooms || [])];

    // Sort rooms by $updatedAt in descending order
    const sortedRooms = updatedRooms.sort(
      (a, b) =>
        new Date(b.$updatedAt).getTime() - new Date(a.$updatedAt).getTime()
    );

    // If the room doesn't exist, add the room to the state
    return {
      ...state,
      isLoading: false,
      rooms: sortedRooms,
    };
  }),
  on(
    findOrAddRoomFailureAction,
    (state, action): RoomStateInterface => ({
      ...state,
      isLoading: false,
      error: action.error,
    })
  ),

  // Set initialState after Logout/Delete Success Action
  on(
    logoutSuccessAction,
    deleteAccountSuccessAction,
    (): RoomStateInterface => ({
      ...initialState,
    })
  ),

  // Clear Error Reducer
  on(
    clearErrorsAction,
    (state): RoomStateInterface => ({
      ...state,
      error: null,
    })
  )
);

export function roomReducers(state: RoomStateInterface, action: Action) {
  return roomReducer(state, action);
}
