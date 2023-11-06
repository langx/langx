import { Action, createReducer, on } from '@ngrx/store';
import { registerAction } from './actions';

export interface LoadingState {
  isLoading: boolean;
}

const initialState: LoadingState = {
  isLoading: false,
};

const loadingReducer = createReducer(
  initialState,
  on(registerAction, (state: LoadingState) => ({
    ...state,
    isLoading: true,
  }))
);

export function reducers(state: LoadingState, action: Action) {
  return loadingReducer(state, action);
}
