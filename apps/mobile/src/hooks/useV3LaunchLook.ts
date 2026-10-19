import { useSyncExternalStore } from 'react'
import { isLaunchOver, subscribeToLaunchOver } from '../lib/launchOver'
import { latchV3LaunchLook } from '../lib/v3LaunchLook'
import { useV3HomeDecision } from './useV3Home'

/**
 * The redesign's look on the launch path — welcome, intro, onboarding —
 * behind `flags.v3Home`. Never a wait: until the flag has answered this is
 * today's look, and it is settled for the launch once the splash has gone.
 * See `latchV3LaunchLook`.
 */
export function useV3LaunchLook(): boolean {
  const decision = useV3HomeDecision()
  const launchOver = useSyncExternalStore(subscribeToLaunchOver, isLaunchOver, isLaunchOver)
  return latchV3LaunchLook({ decision, launchOver })
}
