import { Action, createReducer, on } from '@ngrx/store';

import { UserStateInterface } from 'src/app/models/types/states/userState.interface';
import {
  deleteAccountSuccessAction,
  logoutSuccessAction,
} from 'src/app/store/actions/auth.action';
import {
  getUsersAction,
  getUsersSuccessAction,
  getUsersFailureAction,
  getUsersWithOffsetAction,
  getUsersWithOffsetSuccessAction,
  getUsersWithOffsetFailureAction,
} from 'src/app/store/actions/users.action';
import {
  getUserByIdAction,
  getUserByIdFailureAction,
  getUserByIdSuccessAction,
  reportUserAction,
  reportUserFailureAction,
  reportUserInitialStateAction,
  reportUserSuccessAction,
} from 'src/app/store/actions/user.action';

const initialState: UserStateInterface = {
  isLoading: false,
  total: null,
  users: null,
  user: null,
  error: null,
  report: null,
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

  // Get User By Id Reducers
  on(
    getUserByIdAction,
    (state): UserStateInterface => ({
      ...state,
      isLoading: true,
      error: null,
    })
  ),
  on(
    getUserByIdSuccessAction,
    (state, action): UserStateInterface => ({
      ...state,
      isLoading: false,
      user: action.payload,
    })
  ),
  on(
    getUserByIdFailureAction,
    (state, action): UserStateInterface => ({
      ...state,
      isLoading: false,
      error: action.error,
    })
  ),
  // Set initialState after Logout/Delete Success Action
  on(
    logoutSuccessAction,
    deleteAccountSuccessAction,
    (): UserStateInterface => ({
      ...initialState,
    })
  ),

  // Report User Reducers
  on(
    reportUserAction,
    (state): UserStateInterface => ({
      ...state,
      isLoading: true,
      error: null,
      report: null,
    })
  ),
  on(
    reportUserSuccessAction,
    (state, action): UserStateInterface => ({
      ...state,
      isLoading: false,
      report: action.payload,
    })
  ),
  on(
    reportUserFailureAction,
    (state, action): UserStateInterface => ({
      ...state,
      isLoading: false,
      error: action.error,
    })
  ),
  on(
    reportUserInitialStateAction,
    (state): UserStateInterface => ({
      ...state,
      report: null,
    })
  )
);

export function userReducers(state: UserStateInterface, action: Action) {
  return userReducer(state, action);
}
