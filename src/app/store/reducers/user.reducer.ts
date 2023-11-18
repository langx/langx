import { Action, createReducer, on } from '@ngrx/store';

import { UserStateInterface } from 'src/app/models/types/states/userState.interface';
import { logoutSuccessAction } from '../actions/auth.action';
import {
  getUsersAction,
  getUsersSuccessAction,
  getUsersFailureAction,
  getUsersWithOffsetAction,
  getUsersWithOffsetSuccessAction,
  getUsersWithOffsetFailureAction,
} from 'src/app/store/actions/users.action';

const initialState: UserStateInterface = {
  isLoading: false,
  total: null,
  users: null,
  error: null,
};

const userReducer = createReducer(
  initialState,
  on(
    getUsersAction,
    (state): UserStateInterface => ({
      ...state,
      isLoading: true,
      error: null,
    })
  ),
  on(
    getUsersSuccessAction,
    (state, action): UserStateInterface => ({
      ...state,
      isLoading: false,
      total: action.payload?.total,
      users: action.payload?.documents,
    })
  ),
  on(
    getUsersFailureAction,
    (state, action): UserStateInterface => ({
      ...state,
      isLoading: false,
      error: action.error,
    })
  ),
  on(
    getUsersWithOffsetAction,
    (state): UserStateInterface => ({
      ...state,
      isLoading: true,
      error: null,
    })
  ),
  on(
    getUsersWithOffsetSuccessAction,
    (state, action): UserStateInterface => ({
      ...state,
      isLoading: false,
      total: action.payload?.total,
      users: [...state.users, ...action.payload?.documents],
    })
  ),
  on(
    getUsersWithOffsetFailureAction,
    (state, action): UserStateInterface => ({
      ...state,
      isLoading: false,
      error: action.error,
    })
  ),
  // Clear After Logout Success Action
  on(
    logoutSuccessAction,
    (): UserStateInterface => ({
      ...initialState,
    })
  )
);

export function userReducers(state: UserStateInterface, action: Action) {
  return userReducer(state, action);
}
