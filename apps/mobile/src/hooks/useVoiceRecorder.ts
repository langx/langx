import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio'
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
 * `HIGH_QUALITY` produces m4a/aac on both platforms, which is what the server
 * accepts and what v1's files already are — so a migrated voice note and a new
 * one play through the same path with no transcoding anywhere.
 */
export function useVoiceRecorder() {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY)
  const state = useAudioRecorderState(recorder)
  const [error, setError] = useState<string | null>(null)

  const start = useCallback(async (): Promise<boolean> => {
    setError(null)
    const permission = await AudioModule.requestRecordingPermissionsAsync()
    if (!permission.granted) {
      setError('LangX needs microphone access to record a voice message.')
      return false
    }
    // Without this, iOS records at a much lower quality and playback routes to
    // the earpiece rather than the speaker.
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true })
    await recorder.prepareToRecordAsync()
    recorder.record()
    return true
  }, [recorder])

  const stop = useCallback(async (): Promise<Recording | null> => {
    await recorder.stop()
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true })
    if (!recorder.uri) return null
    return {
      uri: recorder.uri,
      durationSeconds: Math.max(1, Math.round((state.durationMillis ?? 0) / 1000)),
      contentType: 'audio/m4a',
    }
  }, [recorder, state.durationMillis])

  const cancel = useCallback(async (): Promise<void> => {
    if (state.isRecording) await recorder.stop()
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true })
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
