export enum ActionTypes {
  GET_MESSAGES_WITH_OFFSET = '[Message] Get Messages With Offset',
  GET_MESSAGES_WITH_OFFSET_SUCCESS = '[Message] Get Messages With Offset Success',
  GET_MESSAGES_WITH_OFFSET_FAILURE = '[Message] Get Messages With Offset Failure',

  CREATE_MESSAGE = '[Message] Create Message',
  CREATE_MESSAGE_SUCCESS = '[Message] Create Message Success',
  CREATE_MESSAGE_FAILURE = '[Message] Create Message Failure',

  UPDATE_MESSAGE = '[Message] Update Message',
  UPDATE_MESSAGE_SUCCESS = '[Message] Update Message Success',
  UPDATE_MESSAGE_FAILURE = '[Message] Update Message Failure',

  DELETE_MESSAGE = '[Message] Delete Message',
  DELETE_MESSAGE_SUCCESS = '[Message] Delete Message Success',
  DELETE_MESSAGE_FAILURE = '[Message] Delete Message Failure',

  ATTACH_COPILOT = '[Message] Attach Copilot',
  DETACH_COPILOT = '[Message] Detach Copilot',
  DETACH_COPILOT_SUCCESS = '[Message] Detach Copilot Success Message',
  DETACH_COPILOT_FAILURE = '[Message] Detach Copilot Failure Message',

  ACTIVATE_ROOM = '[Message] Activate Room',
  DEACTIVATE_ROOM = '[Message] Deactivate Room',

  CLEAR_ERRORS = '[Message] Clear Errors',
}
