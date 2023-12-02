export enum ActionTypes {
  UPLOAD_PROFILE_PICTURE = '[S3] Upload Profile Picture',
  UPLOAD_PROFILE_PICTURE_SUCCESS = '[S3] Upload Profile Picture Success',
  UPLOAD_PROFILE_PICTURE_FAILURE = '[S3] Upload Profile Picture Failure',

  UPLOAD_OTHER_PHOTOS = '[S3] Upload Other Photos',
  UPLOAD_OTHER_PHOTOS_SUCCESS = '[S3] Upload Other Photos Success',
  UPLOAD_OTHER_PHOTOS_FAILURE = '[S3] Upload Other Photos Failure',

  UPLOAD_IMAGE_FOR_MESSAGE = '[S3] Upload Image For Message',
  UPLOAD_IMAGE_FOR_MESSAGE_SUCCESS = '[S3] Upload Image For Message Success',
  UPLOAD_IMAGE_FOR_MESSAGE_FAILURE = '[S3] Upload Image For Message Failure',
  CLEAR_IMAGE_URL_STATE = '[S3] Clear Image Url State',

  UPLOAD_AUDIO_FOR_MESSAGE = '[S3] Upload Audio For Message',
  UPLOAD_AUDIO_FOR_MESSAGE_SUCCESS = '[S3] Upload Audio For Message Success',
  UPLOAD_AUDIO_FOR_MESSAGE_FAILURE = '[S3] Upload Audio For Message Failure',
  CLEAR_AUDIO_URL_STATE = '[S3] Clear Audio Url State',
}
