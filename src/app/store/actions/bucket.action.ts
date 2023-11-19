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
