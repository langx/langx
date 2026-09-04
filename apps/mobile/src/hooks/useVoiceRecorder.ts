import { AudioModule, RecordingPresets, useAudioRecorder, useAudioRecorderState } from 'expo-audio'
import { Platform } from 'react-native'
import { ensurePlaybackAudioMode, ensureRecordingAudioMode } from '../lib/audioSession'
import { nativeRecordingType, webRecordingType } from '../lib/recordingFormat'
import { currentTranslate } from '../i18n/runtime'
import { useCallback, useState } from 'react'
import { MAX_AUDIO_SECONDS } from '@langx/shared'

export interface Recording {
  uri: string
  durationSeconds: number
  contentType: string
}

/**
 * Records a voice message, capped at `MAX_AUDIO_SECONDS`.
 *
 * `HIGH_QUALITY` produces AAC on both native platforms, which is what the
 * server accepts and what v1's files already are — so a migrated voice note
 * and a new one play through the same path with no transcoding anywhere.
 *
 * The web is the exception and used to be lied about: `MediaRecorder` there
 * usually produces WebM/Opus, which no iPhone can decode, and every recording
 * was labelled `audio/m4a` regardless. The type here is now a best guess that
 * the upload corrects from the blob itself — see `lib/recordingFormat.ts`.
 */
/** `MediaRecorder.isTypeSupported`, where there is one. */
function mediaRecorderSupports(type: string): boolean {
  const recorder = (globalThis as { MediaRecorder?: { isTypeSupported?(t: string): boolean } })
    .MediaRecorder
  return recorder?.isTypeSupported?.(type) ?? false
}

export function useVoiceRecorder() {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY)
  const state = useAudioRecorderState(recorder)
  const [error, setError] = useState<string | null>(null)

  const start = useCallback(async (): Promise<boolean> => {
    setError(null)
    const permission = await AudioModule.requestRecordingPermissionsAsync()
    if (!permission.granted) {
      setError(currentTranslate()('notifications.microphonePermission'))
      return false
    }
    // Without this, iOS records at a much lower quality and playback routes to
    // the earpiece rather than the speaker.
    await ensureRecordingAudioMode()
    await recorder.prepareToRecordAsync()
    recorder.record()
    return true
  }, [recorder])

  const stop = useCallback(async (): Promise<Recording | null> => {
    await recorder.stop()
    // Back to playback, so the note that is about to be played — and every
    // note played later in this session — is not left in a recording session.
    await ensurePlaybackAudioMode()
    if (!recorder.uri) return null
    return {
      uri: recorder.uri,
      durationSeconds: Math.max(1, Math.round((state.durationMillis ?? 0) / 1000)),
      contentType:
        Platform.OS === 'web'
          ? webRecordingType(undefined, mediaRecorderSupports)
          : nativeRecordingType(),
    }
  }, [recorder, state.durationMillis])

  const cancel = useCallback(async (): Promise<void> => {
    if (state.isRecording) await recorder.stop()
    await ensurePlaybackAudioMode()
  }, [recorder, state.isRecording])

  const seconds = Math.floor((state.durationMillis ?? 0) / 1000)

  return {
    isRecording: state.isRecording,
    seconds,
    atLimit: seconds >= MAX_AUDIO_SECONDS,
    error,
    start,
    stop,
    cancel,
  }
}
