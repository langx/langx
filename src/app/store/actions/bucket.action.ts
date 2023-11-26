import { createAction, props } from '@ngrx/store';

import { ActionTypes } from 'src/app/store/actions/types/bucket.actiontypes';
import { User } from 'src/app/models/User';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';

// Upload Profile Picture
export const uploadProfilePictureAction = createAction(
  ActionTypes.UPLOAD_PROFILE_PICTURE,
  props<{ request: File; currentUserId: string }>()
);

export const uploadProfilePictureSuccessAction = createAction(
  ActionTypes.UPLOAD_PROFILE_PICTURE_SUCCESS,
  props<{ payload: User }>()
);

export const uploadProfilePictureFailureAction = createAction(
  ActionTypes.UPLOAD_PROFILE_PICTURE_FAILURE,
  props<{ error: ErrorInterface }>()
);

// Upload Other Photos
export const uploadOtherPhotosAction = createAction(
  ActionTypes.UPLOAD_OTHER_PHOTOS,
  props<{ request: File; currentUserId: string; otherPhotos: URL[] }>()
);

export const uploadOtherPhotosSuccessAction = createAction(
  ActionTypes.UPLOAD_OTHER_PHOTOS_SUCCESS,
  props<{ payload: User }>()
);

export const uploadOtherPhotosFailureAction = createAction(
  ActionTypes.UPLOAD_OTHER_PHOTOS_FAILURE,
  props<{ error: ErrorInterface }>()
);

// Upload Image For Message
export const uploadImageForMessageAction = createAction(
  ActionTypes.UPLOAD_IMAGE_FOR_MESSAGE,
  props<{ request: File }>()
);

export const uploadImageForMessageSuccessAction = createAction(
  ActionTypes.UPLOAD_IMAGE_FOR_MESSAGE_SUCCESS,
  props<{ payload: URL }>()
);

export const uploadImageForMessageFailureAction = createAction(
  ActionTypes.UPLOAD_IMAGE_FOR_MESSAGE_FAILURE,
  props<{ error: ErrorInterface }>()
);

export const clearImageUrlStateAction = createAction(
  ActionTypes.CLEAR_IMAGE_URL_STATE
);

// Upload Audio For Message
export const uploadAudioForMessageAction = createAction(
  ActionTypes.UPLOAD_AUDIO_FOR_MESSAGE,
  props<{ request: File }>()
);

export const uploadAudioForMessageSuccessAction = createAction(
  ActionTypes.UPLOAD_AUDIO_FOR_MESSAGE_SUCCESS,
  props<{ payload: URL }>()
);

export const uploadAudioForMessageFailureAction = createAction(
  ActionTypes.UPLOAD_AUDIO_FOR_MESSAGE_FAILURE,
  props<{ error: ErrorInterface }>()
);

export const clearAudioUrlStateAction = createAction(
  ActionTypes.CLEAR_AUDIO_URL_STATE
);
