import { createFeatureSelector, createSelector } from '@ngrx/store';

import { RoomStateInterface } from 'src/app/models/types/states/roomState.interface';

export const roomFeatureSelector =
  createFeatureSelector<RoomStateInterface>('room');

export const isLoadingSelector = createSelector(
  roomFeatureSelector,
  (roomState: RoomStateInterface) => roomState.isLoading
);

export const roomsSelector = createSelector(
  roomFeatureSelector,
  (roomState: RoomStateInterface) => roomState.rooms
);

export const totalRoomsSelector = createSelector(
  roomFeatureSelector,
  (roomState: RoomStateInterface) => roomState.total_rooms
);

export const errorSelector = createSelector(
  roomFeatureSelector,
  (roomState: RoomStateInterface) => roomState.error
);
