import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';

import { Room } from '@/models/Room';
import { Message } from '@/models/Message';
import { RoomExtendedInterface } from '@/models/extended/RoomExtended.interface';
import { extendRoom } from '@/services/roomService';

interface RoomState {
  rooms: RoomExtendedInterface[];
  room: RoomExtendedInterface | null;
  isLoading: boolean;
  error: string | null;
}

const initialState: RoomState = {
  rooms: [],
  room: null,
  isLoading: false,
  error: null,
};

export const createRoomThunk = createAsyncThunk(
  'room/createRoomThunk',
  async (room: Room, { dispatch }) => {
    try {
      const createdRoom = await extendRoom(room);
      dispatch(createRoom(createdRoom));
    } catch (error) {
      console.error(error);
      dispatch(setError((error as Error).message || 'An error occurred'));
    }
  }
);

const roomSlice = createSlice({
  name: 'room',
  initialState: initialState as RoomState,
  reducers: {
    setRooms: (state, action: PayloadAction<RoomExtendedInterface[]>) => {
      state.rooms = action.payload;
    },
    createRoom: (state, action: PayloadAction<RoomExtendedInterface>) => {
      state.rooms.unshift(action.payload);
    },
    updateRooms: (state, action: PayloadAction<Room>) => {
      const roomIndex = state.rooms.findIndex(
        (room: RoomExtendedInterface) => room.$id === action.payload.$id
      );

      if (roomIndex !== -1) {
        if (
          action.payload.lastMessageUpdatedAt >
          state.rooms[roomIndex].lastMessageUpdatedAt
        ) {
          const updatedRoom: RoomExtendedInterface = {
            ...state.rooms[roomIndex],
            ...action.payload,
            userData: state.rooms[roomIndex].userData,
            messages: state.rooms[roomIndex].messages,
          };
          state.rooms.splice(roomIndex, 1);
          state.rooms.unshift(updatedRoom);
        } else {
          state.rooms[roomIndex] = {
            ...state.rooms[roomIndex],
            ...action.payload,
          };
        }
      }

      // TODO: Update room in state.room if it is the same room
    },
    setRoom: (state, action: PayloadAction<RoomExtendedInterface | null>) => {
      state.room = action.payload;
    },
    setRoomMessages(state, action: PayloadAction<Message[]>) {
      if (state.room) {
        state.room = {
          ...state.room,
          messages: action.payload,
        };
      }
    },
    createMessage: (state, action: PayloadAction<Message>) => {
      console.log('createMessage payload', action.payload);
      // Update the room if it is the same room
      if (state.room) {
        if (state.room.$id === action.payload.roomId['$id']) {
          state.room = {
            ...state.room,
            messages: [action.payload, ...state.room.messages],
            lastMessageUpdatedAt: action.payload.createdAt,
          };
        }
      }

      // Find the room in the rooms array and update messages
      const roomIndex = state.rooms.findIndex(
        (room: RoomExtendedInterface) =>
          room.$id === action.payload.roomId['$id']
      );
      if (roomIndex !== -1) {
        state.rooms[roomIndex].messages.unshift(action.payload);
      }
    },
    updateMessage: (state, action: PayloadAction<Message>) => {
      // Update the message in the current room if it is the same room
      if (state.room && state.room.$id === action.payload.roomId['$id']) {
        const currentMessageIndex = state.room.messages.findIndex(
          (message: Message) => message.$id === action.payload.$id
        );
        if (currentMessageIndex !== -1) {
          // Update the message if found
          state.room.messages[currentMessageIndex] = action.payload;
          // Optionally update lastMessageUpdatedAt if needed
          state.room.lastMessageUpdatedAt = action.payload.createdAt;
        } else {
          console.log('Message not found in current room, unable to update');
        }
      }

      // Find and update the message in the rooms array
      const roomIndex = state.rooms.findIndex(
        (room: RoomExtendedInterface) =>
          room.$id === action.payload.roomId['$id']
      );
      if (roomIndex !== -1) {
        const messageIndex = state.rooms[roomIndex].messages.findIndex(
          (message: Message) => message.$id === action.payload.$id
        );
        if (messageIndex !== -1) {
          state.rooms[roomIndex].messages[messageIndex] = action.payload;
        } else {
          console.log('Message not found in rooms array, unable to update');
        }
      }
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    setRoomInitialState: (state) => {
      Object.assign(state, initialState);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(createRoomThunk.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(createRoomThunk.fulfilled, (state) => {
        state.isLoading = false;
      })
      .addCase(createRoomThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'An error occurred';
      });
  },
});

export const {
  setRooms,
  createRoom,
  updateRooms,
  setRoom,
  setRoomMessages,
  createMessage,
  updateMessage,
  setLoading,
  setError,
  setRoomInitialState,
} = roomSlice.actions;

export default roomSlice.reducer;
