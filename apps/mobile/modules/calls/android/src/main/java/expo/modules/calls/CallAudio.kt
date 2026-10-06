package expo.modules.calls

import android.content.Context
import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.os.Build

/**
 * Where a call's sound comes out: the earpiece for a voice call held to the
 * ear, the speaker for a video call held in front of the face — the default
 * every phone's dialer and every messenger uses — and the toggle between them.
 * A headset, wired or Bluetooth, wins over both, which Android does by itself
 * once the mode says this is a conversation.
 */
object CallAudio {
  fun begin(context: Context, speaker: Boolean) {
    val audio = context.getSystemService(AudioManager::class.java) ?: return
    audio.mode = AudioManager.MODE_IN_COMMUNICATION
    setSpeaker(context, speaker)
  }

  fun end(context: Context) {
    val audio = context.getSystemService(AudioManager::class.java) ?: return
    if (Build.VERSION.SDK_INT >= 31) audio.clearCommunicationDevice()
    else @Suppress("DEPRECATION") { audio.isSpeakerphoneOn = false }
    audio.mode = AudioManager.MODE_NORMAL
  }

  fun setSpeaker(context: Context, on: Boolean) {
    val audio = context.getSystemService(AudioManager::class.java) ?: return
    if (Build.VERSION.SDK_INT >= 31) {
      if (!on) {
        audio.clearCommunicationDevice()
        return
      }
      audio.availableCommunicationDevices
          .firstOrNull { it.type == AudioDeviceInfo.TYPE_BUILTIN_SPEAKER }
          ?.let(audio::setCommunicationDevice)
    } else {
      @Suppress("DEPRECATION")
      audio.isSpeakerphoneOn = on
    }
  }
}
