import { useUploadAvatar } from '../api/queries'
import { ApiRequestError } from '../api/client'
import { useT } from '../i18n'
import { showAlert } from '../lib/alert'
import { pickImageAsset } from '../lib/pickMediaAsset'
import { showToast } from '../lib/toast'

/**
 * Replacing the profile photo: where from, the OS cropper, the upload, and a
 * word either way.
 *
 * Two places start it — Edit Profile's "Change photo" and a long press on the
 * avatar in Me — and they share this so a refused permission or a server with
 * no storage gets the same answer from both.
 */
export function useChangeAvatar() {
  const t = useT()
  const upload = useUploadAvatar()

  async function change(): Promise<void> {
    // Edit Profile disables its button while one is going up. Me cannot
    // disable its avatar without also losing the tap that opens the photo, so
    // a second long press is ignored here instead.
    if (upload.isPending) return
    const picked = await pickImageAsset({ allowsEditing: true })
    if (picked.status === 'denied') {
      // Which permission was refused, not "photos" for both: being told to
      // allow the photo library after declining the camera is advice that
      // does not work.
      void showAlert(
        picked.source === 'camera' ? t('media.cameraTitle') : t('chat.photosTitle'),
        picked.source === 'camera' ? t('media.cameraPermission') : t('chat.photosPermission'),
      )
      return
    }
    if (picked.status === 'unsupported') {
      void showAlert(t('errors.uploadFailed'), t('errors.attachmentUnsupported'))
      return
    }
    if (picked.status === 'cancelled') return
    upload.mutate(
      { uri: picked.image.uri, contentType: picked.image.contentType },
      {
        onError: (caught) => {
          // Storage may simply not be configured yet on this instance; say so
          // rather than showing a generic failure the user cannot act on.
          void showAlert(
            t('errors.uploadFailed'),
            caught instanceof ApiRequestError && caught.code === 'INTERNAL'
              ? t('editProfile.storageUnconfigured')
              : t('editProfile.uploadRetry'),
          )
        },
        onSuccess: () => showToast(t('editProfile.photoUpdated')),
      },
    )
  }

  return { change, isPending: upload.isPending }
}
