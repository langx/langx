import { Action, createReducer, on } from '@ngrx/store';

import { deletedUser } from 'src/app/extras/deletedUser';
import { VisitsStateInterface } from 'src/app/models/types/states/visitsState.interface';
import {
  getVisitsAction,
  getVisitsFailureAction,
  getVisitsSuccessAction,
  getVisitsWithOffsetAction,
  getVisitsWithOffsetFailureAction,
  getVisitsWithOffsetSuccessAction,
} from 'src/app/store/actions/visits.action';
import {
  deleteAccountSuccessAction,
  logoutSuccessAction,
} from '../actions/auth.action';

const initialState: VisitsStateInterface = {
  isLoading: false,
  total: null,
  visits: null,
  error: null,
};

const visitsReducer = createReducer(
  initialState,

  // Get Visits Reducers
  on(
    getVisitsAction,
    (state): VisitsStateInterface => ({
      ...state,
      isLoading: true,
      error: null,
    })
  ),
  on(getVisitsSuccessAction, (state, action): VisitsStateInterface => {
    // Map through the documents and add deletedUser if from is null
    const visits = action.payload.documents.map((document) => {
      if (document.from === null) {
        return {
          ...document,
          from: deletedUser,
        };
      }
      return document;
    });

    return {
      ...state,
      isLoading: false,
      total: action.payload.total,
      visits: visits,
    };
  }),
  on(
    getVisitsFailureAction,
    (state, action): VisitsStateInterface => ({
      ...state,
      isLoading: false,
      error: action.error,
    })
  ),

  // Get Visits With Offset Reducers
  on(
    getVisitsWithOffsetAction,
    (state): VisitsStateInterface => ({
      ...state,
      isLoading: true,
      error: null,
    })
  ),
  on(
    getVisitsWithOffsetSuccessAction,
    (state, action): VisitsStateInterface => ({
      ...state,
      isLoading: false,
      total: action.payload.total,
      visits: [...state.visits, ...action.payload.documents],
    })
  ),
  on(
    getVisitsWithOffsetFailureAction,
    (state, action): VisitsStateInterface => ({
      ...state,
      isLoading: false,
      error: action.error,
    })
  ),

  // Set initialState after Logout/Delete Success Action
  on(
    logoutSuccessAction,
    deleteAccountSuccessAction,
    (): VisitsStateInterface => ({
      ...initialState,
    })
  )
);

export function visitsReducers(state: VisitsStateInterface, action: Action) {
  return visitsReducer(state, action);
}
