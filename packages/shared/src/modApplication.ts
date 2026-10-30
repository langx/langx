import { z } from 'zod'

/**
 * Asking to become a moderator, from the sheet behind somebody's MOD badge.
 *
 * Moderators are picked, not elected — see `moderator.ts` — so an application
 * is a row an operator reads and answers, never a switch it flips. What it
 * asks for first is a streak: sixty days in a row is the cheapest proof we
 * have that somebody is here every day, which is the one thing a report queue
 * needs from the person working it, and it cannot be bought or faked in an
 * afternoon.
 */
export const MOD_APPLICATION_MIN_STREAK = 60

/**
 * The questions, in the order the form asks them. The words are the app's
 * (`modApplication.questions.*`) and the panel's (`adminStrings`); the server
 * keeps only these keys, so a question reworded later still lines up with the
 * answers given to it.
 */
export const MOD_APPLICATION_QUESTIONS = ['why', 'experience', 'situation', 'time'] as const
export type ModApplicationQuestion = (typeof MOD_APPLICATION_QUESTIONS)[number]

/**
 * Long enough to say something an operator can judge by — "I like the app"
 * is not an application — and short enough to stay an answer.
 */
export const MOD_APPLICATION_ANSWER_MIN = 20
export const MOD_APPLICATION_ANSWER_MAX = 1000

const answerSchema = z
  .string()
  .trim()
  .min(MOD_APPLICATION_ANSWER_MIN)
  .max(MOD_APPLICATION_ANSWER_MAX)

export const modApplicationSchema = z.object({
  answers: z.object({
    why: answerSchema,
    experience: answerSchema,
    situation: answerSchema,
    time: answerSchema,
  }),
})
export type ModApplicationInput = z.infer<typeof modApplicationSchema>

/**
 * Where the asker stands, for the sheet's button. `open` is an application
 * still waiting in the queue: one at a time, so a second press is not a
 * second row for an operator to read.
 */
export interface ModApplicationStatus {
  open: boolean
}
