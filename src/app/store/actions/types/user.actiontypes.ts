export enum ActionTypes {
  GET_CURRENT_USER = '[User] Get Current User',
  GET_CURRENT_USER_SUCCESS = '[User] Get Current User Success',
  GET_CURRENT_USER_FAILURE = '[User] Get Current User Failure',

  UPDATE_CURRENT_USER = '[User] Update Current User',
  UPDATE_CURRENT_USER_SUCCESS = '[User] Update Current User Success',
  UPDATE_CURRENT_USER_FAILURE = '[User] Update Current User Failure',

  GET_USER_BY_ID = '[User] Get User By Id',
  GET_USER_BY_ID_SUCCESS = '[User] Get User By Id Success',
  GET_USER_BY_ID_FAILURE = '[User] Get User By Id Failure',

  REPORT_USER = '[User] Report User',
  REPORT_USER_SUCCESS = '[User] Report User Success',
  REPORT_USER_FAILURE = '[User] Report User Failure',
  REPORT_USER_INITIAL_STATE = '[User] Report User Initial State',

  BLOCK_USER = '[User] Block User',
  BLOCK_USER_SUCCESS = '[User] Block User Success',
  BLOCK_USER_FAILURE = '[User] Block User Failure',
  BLOCK_USER_INITIAL_STATE = '[User] Block User Initial State',

  UNBLOCK_USER = '[User] Unblock User',
  UNBLOCK_USER_SUCCESS = '[User] Unblock User Success',
  UNBLOCK_USER_FAILURE = '[User] Unblock User Failure',
  UNBLOCK_USER_INITIAL_STATE = '[User] Unblock User Initial State',

  GET_BLOCKED_USERS = '[User] Get Blocked Users',
  GET_BLOCKED_USERS_SUCCESS = '[User] Get Blocked Users Success',
  GET_BLOCKED_USERS_FAILURE = '[User] Get Blocked Users Failure',

  CHECK_USERNAME = '[User] Check Username',
  CHECK_USERNAME_SUCCESS = '[User] Check Username Success',
  CHECK_USERNAME_FAILURE = '[User] Check Username Failure',

  CLEAR_ERRORS = '[Users] Clear Errors',
}
