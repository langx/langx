import { Action, createReducer, on } from '@ngrx/store';

import { VisitsStateInterface } from 'src/app/models/types/states/visitsState.interface';
import {
  getVisitsAction,
  getVisitsFailureAction,
  getVisitsSuccessAction,
} from 'src/app/store/actions/visits.action';

const initialState: VisitsStateInterface = {
  isLoading: false,
  total: null,
  visits: null,
  error: null,
};

const visitsReducer = createReducer(
  initialState,
  on(
    getVisitsAction,
    (state): VisitsStateInterface => ({
      ...state,
      isLoading: true,
      error: null,
    })
  ),
  on(
    getVisitsSuccessAction,
    (state, action): VisitsStateInterface => ({
      ...state,
      isLoading: false,
      total: action.payload.total,
      visits: action.payload.documents,
    })
  ),
  on(
    getVisitsFailureAction,
    (state, action): VisitsStateInterface => ({
      ...state,
      isLoading: false,
      error: action.error,
    })
  )
);

export function visitsReducers(state: VisitsStateInterface, action: Action) {
  return visitsReducer(state, action);
}
