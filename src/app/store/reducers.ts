import { Action, createReducer, on } from '@ngrx/store';

import {
  registerAction,
  registerFailureAction,
  registerSuccessAction,
} from './actions/register.action';
import { AuthStateInterface } from '../models/types/states/authState.interface';

const initialState: AuthStateInterface = {
  isLoading: false,
  account: null,
  currentUser: null,
  isLoggedIn: null,
  validationError: null,
};

const loadingReducer = createReducer(
  initialState,
  on(
    registerAction,
    (state): AuthStateInterface => ({
      ...state,
      isLoading: true,
      validationError: null,
    })
  ),
  on(
    registerSuccessAction,
    (state, action): AuthStateInterface => ({
      ...state,
      isLoading: false,
      isLoggedIn: true,
      account: action.payload,
    })
  ),
  on(
    registerFailureAction,
    (state, action): AuthStateInterface => ({
      ...state,
      isLoading: false,
      validationError: action.error,
    })
  )
);

export function reducers(state: AuthStateInterface, action: Action) {
  return loadingReducer(state, action);
}
