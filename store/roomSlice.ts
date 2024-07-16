import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';

import { RoomExtendedInterface } from '@/models/extended/RoomExtended.interface';
import { Room } from '@/models/Room';
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
    },
    setRoom: (state, action: PayloadAction<RoomExtendedInterface | null>) => {
      state.room = action.payload;
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
  setLoading,
  setError,
  setRoomInitialState,
} = roomSlice.actions;

export default roomSlice.reducer;
