export enum ActionTypes {
  LOGIN = '[Auth] Login',
  LOGIN_SUCCESS = '[Auth] Login Success',
  LOGIN_FAILURE = '[Auth] Login Failure',

  ISLOGGEDIN = '[Auth] IsLoggedIn',
  ISLOGGEDIN_SUCCESS = '[Auth] IsLoggedIn Success',
  ISLOGGEDIN_SUCCESS_COMPLETE_REGISTRATION = '[Auth] IsLoggedIn Success Complete Registration',
  ISLOGGEDIN_SUCCESS_LANGUAGE_SELECTION = '[Auth] IsLoggedIn Success Language Selection',
  ISLOGGEDIN_FAILURE = '[Auth] IsLoggedIn Failure',

  REGISTER = '[Auth] Register',
  REGISTER_SUCCESS = '[Auth] Register Success',
  REGISTER_FAILURE = '[Auth] Register Failure',

  COMPLETE_REGISTRATION = '[Auth] Complete Registration',
  COMPLETE_REGISTRATION_SUCCESS = '[Auth] Complete Registration Success',
  COMPLETE_REGISTRATION_FAILURE = '[Auth] Complete Registration Failure',

  LANGUAGE_SELECTION_SUCCESS = '[Auth] Language Selection Success',
  LANGUAGE_SELECTION_FAILURE = '[Auth] Language Selection Failure',
  UPDATE_LANGUAGE_ARRAY = '[Auth] Update Language Array',
  UPDATE_LANGUAGE_ARRAY_SUCCESS = '[Auth] Update Language Array Success',
  UPDATE_LANGUAGE_ARRAY_FAILURE = '[Auth] Update Language Array Failure',

  VERIFY_EMAIL = '[Auth] Verify Email',
  VERIFY_EMAIL_SUCCESS = '[Auth] Verify Email Success',
  VERIFY_EMAIL_FAILURE = '[Auth] Verify Email Failure',
  VERIFY_EMAIL_CONFIRMATION = '[Auth] Verify Email Confirmation',
  VERIFY_EMAIL_CONFIRMATION_SUCCESS = '[Auth] Verify Email Confirmation Success',
  VERIFY_EMAIL_CONFIRMATION_FAILURE = '[Auth] Verify Email Confirmation Failure',

  RESET_PASSWORD = '[Auth] Reset Password',
  RESET_PASSWORD_SUCCESS = '[Auth] Reset Password Success',
  RESET_PASSWORD_FAILURE = '[Auth] Reset Password Failure',
  RESET_PASSWORD_CONFIRMATION = '[Auth] Reset Password Confirmation',
  RESET_PASSWORD_CONFIRMATION_SUCCESS = '[Auth] Reset Password Confirmation Success',
  RESET_PASSWORD_CONFIRMATION_FAILURE = '[Auth] Reset Password Confirmation Failure',

  UPDATE_PASSWORD = '[Auth] Update Password',
  UPDATE_PASSWORD_SUCCESS = '[Auth] Update Password Success',
  UPDATE_PASSWORD_FAILURE = '[Auth] Update Password Failure',
  UPDATE_PASSWORD_RESET_VALUES = '[Auth] Update Password Reset Values',

  LIST_IDENTITIES = '[Auth] List Identities',
  LIST_IDENTITIES_SUCCESS = '[Auth] List Identities Success',
  LIST_IDENTITIES_FAILURE = '[Auth] List Identities Failure',
  DELETE_IDENTITY = '[Auth] Delete Identity',
  DELETE_IDENTITY_SUCCESS = '[Auth] Delete Identity Success',
  DELETE_IDENTITY_FAILURE = '[Auth] Delete Identity Failure',

  LIST_SESSIONS = '[Auth] List Sessions',
  LIST_SESSIONS_SUCCESS = '[Auth] List Sessions Success',
  LIST_SESSIONS_FAILURE = '[Auth] List Sessions Failure',
  DELETE_SESSION = '[Auth] Delete Session',
  DELETE_SESSION_SUCCESS = '[Auth] Delete Session Success',
  DELETE_SESSION_FAILURE = '[Auth] Delete Session Failure',

  DELETE_ACCOUNT = '[Auth] Delete Account',
  DELETE_ACCOUNT_SUCCESS = '[Auth] Delete Account Success',
  DELETE_ACCOUNT_FAILURE = '[Auth] Delete Account Failure',

  LOGOUT = '[Auth] Logout',
  LOGOUT_SUCCESS = '[Auth] Logout Success',
  LOGOUT_FAILURE = '[Auth] Logout Failure',

  CLEAR_ERRORS = '[Auth] Clear Errors',
}
