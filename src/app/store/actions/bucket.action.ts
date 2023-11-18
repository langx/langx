import { createAction, props } from '@ngrx/store';

import { ActionTypes } from 'src/app/store/actions/types/bucket.actiontypes';
import { BucketFile } from 'src/app/models/BucketFile';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';

export const uploadProfilePictureAction = createAction(
  ActionTypes.UPLOAD_PROFILE_PICTURE,
  props<{ request: File }>()
);

export const uploadProfilePictureSuccessAction = createAction(
  ActionTypes.UPLOAD_PROFILE_PICTURE_SUCCESS,
  props<{ payload: URL }>()
);

export const uploadProfilePictureFailureAction = createAction(
  ActionTypes.UPLOAD_PROFILE_PICTURE_FAILURE,
  props<{ error: ErrorInterface }>()
);
