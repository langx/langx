import { Action, createReducer, on } from '@ngrx/store';

import { CommunityStateInterface } from 'src/app/models/types/states/communityState.interface';
import {
  getUsersAction,
  getUsersSuccessAction,
  getUsersFailureAction,
  getUsersWithOffsetAction,
  getUsersWithOffsetSuccessAction,
  getUsersWithOffsetFailureAction,
  getRoomAction,
  getRoomSuccessAction,
  getRoomFailureAction,
  createRoomAction,
  createRoomSuccessAction,
  createRoomFailureAction,
} from 'src/app/store/actions/community.action';

const initialState: CommunityStateInterface = {
  isLoading: false,
  total: null,
  users: null,
  room: null,
  error: null,
};

const communityReducer = createReducer(
  initialState,
  // Get Users Reducers
  on(
    getUsersAction,
    (state): CommunityStateInterface => ({
      ...state,
      isLoading: true,
      error: null,
    })
  ),
  on(
    getUsersSuccessAction,
    (state, action): CommunityStateInterface => ({
      ...state,
      isLoading: false,
      total: action.payload?.total,
      users: action.payload?.documents,
    })
  ),
  on(
    getUsersFailureAction,
    (state, action): CommunityStateInterface => ({
      ...state,
      isLoading: false,
      error: action.error,
    })
  ),
  on(
    getUsersWithOffsetAction,
    (state): CommunityStateInterface => ({
      ...state,
      isLoading: true,
      error: null,
    })
  ),
  on(
    getUsersWithOffsetSuccessAction,
    (state, action): CommunityStateInterface => ({
      ...state,
      isLoading: false,
      total: action.payload?.total,
      users: [...state.users, ...action.payload?.documents],
    })
  ),
  on(
    getUsersWithOffsetFailureAction,
    (state, action): CommunityStateInterface => ({
      ...state,
      isLoading: false,
      error: action.error,
    })
  ),
  on(
    getRoomAction,
    (state): CommunityStateInterface => ({
      ...state,
      isLoading: true,
      error: null,
      room: null,
    })
  ),
  on(
    getRoomSuccessAction,
    (state, action): CommunityStateInterface => ({
      ...state,
      isLoading: false,
      room: action.payload.documents[0],
    })
  ),
  on(
    getRoomFailureAction,
    (state, action): CommunityStateInterface => ({
      ...state,
      isLoading: false,
      error: action.error,
    })
  ),
  on(
    createRoomAction,
    (state): CommunityStateInterface => ({
      ...state,
      isLoading: true,
      error: null,
    })
  ),
  on(
    createRoomSuccessAction,
    (state, action): CommunityStateInterface => ({
      ...state,
      isLoading: false,
      room: action.payload.documents[0],
    })
  ),
  on(
    createRoomFailureAction,
    (state, action): CommunityStateInterface => ({
      ...state,
      isLoading: false,
      error: action.error,
    })
  )
);

export function communityReducers(
  state: CommunityStateInterface,
  action: Action
) {
  return communityReducer(state, action);
}
