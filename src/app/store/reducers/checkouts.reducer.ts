import { Action, createReducer, on } from '@ngrx/store';

import { CheckoutsStateInterface } from 'src/app/models/types/states/checkoutsState.interface';

import {
  getCheckoutsAction,
  getCheckoutsSuccessAction,
  getCheckoutsFailureAction,
  getCheckoutsWithOffsetAction,
  getCheckoutsWithOffsetSuccessAction,
  getCheckoutsWithOffsetFailureAction,
  clearErrorsAction,
} from 'src/app/store/actions/checkouts.action';
import {
  deleteAccountSuccessAction,
  logoutSuccessAction,
} from 'src/app/store/actions/auth.action';

const initialState: CheckoutsStateInterface = {
  isLoading: false,
  total: null,
  checkouts: null,
  error: null,
};

const checkoutsReducer = createReducer(
  initialState,

  // Get Checkouts Reducers
  on(
    getCheckoutsAction,
    (state): CheckoutsStateInterface => ({
      ...state,
      isLoading: true,
      error: null,
    })
  ),
  on(
    getCheckoutsSuccessAction,
    (state, action): CheckoutsStateInterface => ({
      ...state,
      isLoading: false,
      total: action.payload.total,
      checkouts: action.payload.documents,
    })
  ),
  on(
    getCheckoutsFailureAction,
    (state, action): CheckoutsStateInterface => ({
      ...state,
      isLoading: false,
      error: action.error,
    })
  ),

  // Get Checkouts With Offset Reducers
  on(
    getCheckoutsWithOffsetAction,
    (state): CheckoutsStateInterface => ({
      ...state,
      isLoading: true,
      error: null,
    })
  ),
  on(
    getCheckoutsWithOffsetSuccessAction,
    (state, action): CheckoutsStateInterface => ({
      ...state,
      isLoading: false,
      total: action.payload.total,
      checkouts: [...state.checkouts, ...action.payload.documents],
    })
  ),
  on(
    getCheckoutsWithOffsetFailureAction,
    (state, action): CheckoutsStateInterface => ({
      ...state,
      isLoading: false,
      error: action.error,
    })
  ),

  // Set initialState after Logout/Delete Success Action
  on(
    logoutSuccessAction,
    deleteAccountSuccessAction,
    (): CheckoutsStateInterface => ({
      ...initialState,
    })
  ),

  // Clear Errors Actions
  on(
    clearErrorsAction,
    (state): CheckoutsStateInterface => ({
      ...state,
      isLoading: false,
      error: null,
    })
  )
);

export function checkoutsReducers(
  state: CheckoutsStateInterface,
  action: Action
) {
  return checkoutsReducer(state, action);
}
