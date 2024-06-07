import { Action, createReducer, on } from '@ngrx/store';

import { StreaksStateInterface } from 'src/app/models/types/states/streaksState.interface';
import {
  clearErrorsAction,
  getStreaksAction,
  getStreaksFailureAction,
  getStreaksSuccessAction,
  getStreaksWithOffsetAction,
  getStreaksWithOffsetFailureAction,
  getStreaksWithOffsetSuccessAction,
} from 'src/app/store/actions/streaks.action';
import {
  deleteAccountSuccessAction,
  logoutSuccessAction,
} from 'src/app/store/actions/auth.action';

const initialState: StreaksStateInterface = {
  isLoading: false,
  total: null,
  streaks: null,
  error: null,
};

const streaksReducer = createReducer(
  initialState,

  // Get Streaks Reducers
  on(
    getStreaksAction,
    (state): StreaksStateInterface => ({
      ...state,
      isLoading: true,
      error: null,
    })
  ),
  on(
    getStreaksSuccessAction,
    (state, action): StreaksStateInterface => ({
      ...state,
      isLoading: false,
      total: action.payload.total,
      streaks: action.payload.documents,
    })
  ),
  on(
    getStreaksFailureAction,
    (state, action): StreaksStateInterface => ({
      ...state,
      isLoading: false,
      error: action.error,
    })
  ),

  // Get Streaks With Offset Reducers
  on(
    getStreaksWithOffsetAction,
    (state): StreaksStateInterface => ({
      ...state,
      isLoading: true,
      error: null,
    })
  ),
  on(
    getStreaksWithOffsetSuccessAction,
    (state, action): StreaksStateInterface => ({
      ...state,
      isLoading: false,
      total: action.payload.total,
      streaks: [...state.streaks, ...action.payload.documents],
    })
  ),
  on(
    getStreaksWithOffsetFailureAction,
    (state, action): StreaksStateInterface => ({
      ...state,
      isLoading: false,
      error: action.error,
    })
  ),

  // Set initialState after Logout/Delete Success Action
  on(
    logoutSuccessAction,
    deleteAccountSuccessAction,
    (): StreaksStateInterface => ({
      ...initialState,
    })
  ),

  // Clear Errors Actions
  on(
    clearErrorsAction,
    (state): StreaksStateInterface => ({
      ...state,
      isLoading: false,
    })
  )
);

export function streaksReducers(state: StreaksStateInterface, action: Action) {
  return streaksReducer(state, action);
}
