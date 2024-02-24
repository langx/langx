import { Action, createReducer, on } from '@ngrx/store';

import { ContributorsStateInterface } from 'src/app/models/types/states/contributorsState.interface';
import {
  getContributorsAction,
  getContributorsSuccessAction,
  getContributorsFailureAction,
} from 'src/app/store/actions/contributors.action';
import {
  deleteAccountSuccessAction,
  logoutSuccessAction,
} from 'src/app/store/actions/auth.action';

const initialState: ContributorsStateInterface = {
  isLoading: false,
  total: null,
  users: null,
  error: null,
};

const contributorsReducer = createReducer(
  initialState,

  // Get Contributors Reducers
  on(
    getContributorsAction,
    (state): ContributorsStateInterface => ({
      ...state,
      isLoading: true,
      error: null,
    })
  ),
  on(
    getContributorsSuccessAction,
    (state, action): ContributorsStateInterface => ({
      ...state,
      isLoading: false,
      total: action.payload.total,
      users: action.payload.documents,
    })
  ),
  on(
    getContributorsFailureAction,
    (state, action): ContributorsStateInterface => ({
      ...state,
      isLoading: false,
      error: action.error,
    })
  ),

  // Set initialState after Logout/Delete Success Action
  on(
    logoutSuccessAction,
    deleteAccountSuccessAction,
    (): ContributorsStateInterface => ({
      ...initialState,
    })
  )
);

export function contributorsReducers(
  state: ContributorsStateInterface,
  action: Action
) {
  return contributorsReducer(state, action);
}
