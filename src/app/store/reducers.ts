import { Action, createReducer, on } from '@ngrx/store';

import { registerAction } from './actions';
import { LoadingStateInterface } from '../models/types/states/loadingState.interface';

const initialState: LoadingStateInterface = {
  isLoading: false,
};

const loadingReducer = createReducer(
  initialState,
  on(registerAction, (state: LoadingStateInterface) => ({
    ...state,
    isLoading: true,
  }))
);

export function reducers(state: LoadingStateInterface, action: Action) {
  return loadingReducer(state, action);
}
