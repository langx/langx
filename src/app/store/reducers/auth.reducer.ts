import { Action, createReducer, on } from '@ngrx/store';

import { AuthStateInterface } from 'src/app/models/types/states/authState.interface';
import {
  completeRegistrationAction,
  completeRegistrationFailureAction,
  completeRegistrationSuccessAction,
  isLoggedInAction,
  isLoggedInFailureAction,
  isLoggedInSuccessAction,
  languageSelectionAction,
  languageSelectionFailureAction,
  languageSelectionSuccessAction,
  loginAction,
  loginFailureAction,
  loginSuccessAction,
  logoutAction,
  logoutFailureAction,
  logoutSuccessAction,
  registerAction,
  registerFailureAction,
  registerSuccessAction,
  updateLanguageArrayAction,
  updateLanguageArrayFailureAction,
  updateLanguageArraySuccessAction,
} from 'src/app/store/actions/auth.action';
import {
  updatePresenceFailureAction,
  updatePresenceSuccessAction,
} from '../actions/presence.action';
import {
  getUserAction,
  getUserFailureAction,
  getUserSuccessAction,
  updateUserAction,
  updateUserFailureAction,
  updateUserSuccessAction,
} from '../actions/user.action';

const initialState: AuthStateInterface = {
  isLoading: false,
  account: null,
  currentUser: null,
  isLoggedIn: null,
  languages: null,
  isLanguageDone: false,
  registerValidationError: null,
  loginValidationError: null,
  unauthorizedError: null,
  presenceError: null,
  profileError: null,
  editProfileError: null,
};

const authReducer = createReducer(
  initialState,
  //Login Actions
  on(
    loginAction,
    (state): AuthStateInterface => ({
      ...state,
      isLoading: true,
      loginValidationError: null,
    })
  ),
  on(
    loginSuccessAction,
    (state, action): AuthStateInterface => ({
      ...state,
      isLoading: false,
      isLoggedIn: true,
      account: action.payload,
    })
  ),
  on(
    loginFailureAction,
    (state, action): AuthStateInterface => ({
      ...state,
      isLoading: false,
      loginValidationError: action.error,
    })
  ),
  // Register Actions
  on(
    registerAction,
    (state): AuthStateInterface => ({
      ...state,
      isLoading: true,
      registerValidationError: null,
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
      registerValidationError: action.error,
    })
  ),
  // Complete Registration Actions
  on(
    completeRegistrationAction,
    (state): AuthStateInterface => ({
      ...state,
      isLoading: true,
      registerValidationError: null,
    })
  ),
  on(
    completeRegistrationSuccessAction,
    (state, action): AuthStateInterface => ({
      ...state,
      isLoading: false,
      currentUser: action.payload,
    })
  ),
  on(
    completeRegistrationFailureAction,
    (state, action): AuthStateInterface => ({
      ...state,
      isLoading: false,
      registerValidationError: action.error,
    })
  ),
  on(
    languageSelectionAction,
    (state): AuthStateInterface => ({
      ...state,
      isLoading: true,
      registerValidationError: null,
      isLanguageDone: false,
    })
  ),
  on(
    languageSelectionSuccessAction,
    (state, action): AuthStateInterface => ({
      ...state,
      isLoading: false,
      languages: action.payload,
      isLanguageDone: true,
    })
  ),
  on(
    languageSelectionFailureAction,
    (state, action): AuthStateInterface => ({
      ...state,
      isLoading: false,
      registerValidationError: action.error,
    })
  ),
  on(
    updateLanguageArrayAction,
    (state): AuthStateInterface => ({
      ...state,
      isLoading: true,
      registerValidationError: null,
    })
  ),
  on(
    updateLanguageArraySuccessAction,
    (state, action): AuthStateInterface => ({
      ...state,
      isLoading: false,
      currentUser: action.payload,
    })
  ),
  on(
    updateLanguageArrayFailureAction,
    (state, action): AuthStateInterface => ({
      ...state,
      isLoading: false,
      registerValidationError: action.error,
    })
  ),
  // isLoggedIn Actions
  on(
    isLoggedInAction,
    (state): AuthStateInterface => ({
      ...state,
      isLoading: true,
      unauthorizedError: null,
    })
  ),
  on(
    isLoggedInSuccessAction,
    (state, action): AuthStateInterface => ({
      ...state,
      isLoading: false,
      isLoggedIn: true,
      account: action.payload?.account,
      // TODO: No need here to fill currentUser
      currentUser: action.payload?.currentUser,
    })
  ),
  on(
    isLoggedInFailureAction,
    (state, action): AuthStateInterface => ({
      ...state,
      isLoading: false,
      isLoggedIn: false,
      unauthorizedError: action.error,
    })
  ),
  // Get User Actions
  on(
    getUserAction,
    (state): AuthStateInterface => ({
      ...state,
      isLoading: true,
    })
  ),
  on(
    getUserSuccessAction,
    (state, action): AuthStateInterface => ({
      ...state,
      isLoading: false,
      currentUser: action.payload,
    })
  ),
  on(
    getUserFailureAction,
    (state, action): AuthStateInterface => ({
      ...state,
      isLoading: false,
      profileError: action.error,
    })
  ),
  // Update User Actions
  on(
    updateUserAction,
    (state): AuthStateInterface => ({
      ...state,
      isLoading: true,
    })
  ),
  on(
    updateUserSuccessAction,
    (state, action): AuthStateInterface => ({
      ...state,
      isLoading: false,
      currentUser: action.payload,
    })
  ),
  on(
    updateUserFailureAction,
    (state, action): AuthStateInterface => ({
      ...state,
      isLoading: false,
      editProfileError: action.error,
    })
  ),
  // Update Presence Actions
  on(
    updatePresenceSuccessAction,
    (state, action): AuthStateInterface => ({
      ...state,
      currentUser: action.payload,
    })
  ),
  on(
    updatePresenceFailureAction,
    (state, action): AuthStateInterface => ({
      ...state,
      presenceError: action.error,
    })
  ),
  // Logout Actions
  on(
    logoutAction,
    (state): AuthStateInterface => ({
      ...state,
      isLoading: true,
    })
  ),
  on(
    logoutSuccessAction,
    (): AuthStateInterface => ({
      ...initialState,
    })
  ),
  on(
    logoutFailureAction,
    (state, action): AuthStateInterface => ({
      ...state,
      isLoading: false,
      unauthorizedError: action.error,
    })
  )
);

export function authReducers(state: AuthStateInterface, action: Action) {
  return authReducer(state, action);
}
