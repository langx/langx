import { Action, createReducer, on } from '@ngrx/store';

import { SponsorsStateInterface } from 'src/app/models/types/states/sponsorsState.interface';
import {
  getSponsorsAction,
  getSponsorsFailureAction,
  getSponsorsSuccessAction,
} from 'src/app/store/actions/sponsors.action';
import {
  deleteAccountSuccessAction,
  logoutSuccessAction,
} from 'src/app/store/actions/auth.action';

const initialState: SponsorsStateInterface = {
  isLoading: false,
  total: null,
  users: null,
  error: null,
};

const sponsorsReducer = createReducer(
  initialState,

  // Get Sponsors Reducers
  on(
    getSponsorsAction,
    (state): SponsorsStateInterface => ({
      ...state,
      isLoading: true,
      error: null,
    })
  ),
  on(
    getSponsorsSuccessAction,
    (state, action): SponsorsStateInterface => ({
      ...state,
      isLoading: false,
      total: action.payload.total,
      users: action.payload.documents,
    })
  ),
  on(
    getSponsorsFailureAction,
    (state, action): SponsorsStateInterface => ({
      ...state,
      isLoading: false,
      error: action.error,
    })
  ),

  // Set initialState after Logout/Delete Success Action
  on(
    logoutSuccessAction,
    deleteAccountSuccessAction,
    (): SponsorsStateInterface => ({
      ...initialState,
    })
  )
);

export function sponsorReducers(
  state: SponsorsStateInterface,
  action: Action
) {
  return sponsorsReducer(state, action);
}
