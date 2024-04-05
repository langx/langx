export enum ActionTypes {
  GET_MESSAGES_WITH_OFFSET = '[Message] Get Messages With Offset',
  GET_MESSAGES_WITH_OFFSET_SUCCESS = '[Message] Get Messages With Offset Success',
  GET_MESSAGES_WITH_OFFSET_FAILURE = '[Message] Get Messages With Offset Failure',

  CREATE_MESSAGE = '[Message] Create Message',
  CREATE_MESSAGE_SUCCESS = '[Message] Create Message Success',
  CREATE_MESSAGE_FAILURE = '[Message] Create Message Failure',

  UPDATE_MESSAGE= '[Message] Update Message',
  UPDATE_MESSAGE_SUCCESS = '[Message] Update Message Success',
  UPDATE_MESSAGE_FAILURE = '[Message] Update Message Failure',

  DELETE_MESSAGE = '[Message] Delete Message',
  DELETE_MESSAGE_SUCCESS = '[Message] Delete Message Success',
  DELETE_MESSAGE_FAILURE = '[Message] Delete Message Failure',

  ACTIVATE_ROOM = '[Message] Activate Room',
  DEACTIVATE_ROOM = '[Message] Deactivate Room',

  REMOVE_MESSAGE_FROM_TEMP_MESSAGES = '[Message] Delete From Temp Messages',

  RESEND_MESSAGE_FROM_TEMP_MESSAGES = '[Message] Resend From Temp Messages',
  RESEND_MESSAGE_FROM_TEMP_MESSAGES_SUCCESS = '[Message] Resend From Temp Messages Success',
  RESEND_MESSAGE_FROM_TEMP_MESSAGES_FAILURE = '[Message] Resend From Temp Messages Failure',

  CLEAR_ERRORS = '[Message] Clear Errors',
}
