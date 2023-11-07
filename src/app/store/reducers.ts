import { Action, createReducer, on } from '@ngrx/store';

import { registerAction } from './actions';
import { AuthStateInterface } from '../models/types/states/authState.interface';

const initialState: AuthStateInterface = {
  isLoading: false,
};

const loadingReducer = createReducer(
  initialState,
  on(registerAction, (state: AuthStateInterface) => ({
    ...state,
    isLoading: true,
  }))
);

export function reducers(state: AuthStateInterface, action: Action) {
  return loadingReducer(state, action);
}
