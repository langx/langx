import { describe, expect, it } from 'vitest'
import { enqueueReward, finishReward, type QueuedReward } from './rewardQueue'

const wrote = 'you both wrote today'
const echo = 'Echo session'

function build(...rewards: { amount: number; reason: string; haptic?: boolean }[]) {
  return rewards.reduce<QueuedReward[]>((queue, reward, i) => enqueueReward(queue, reward, i + 1), [])
}

describe('enqueueReward', () => {
  it('queues rewards in the order they arrive', () => {
    const queue = build({ amount: 15, reason: wrote }, { amount: 5, reason: echo })
    expect(queue.map((r) => [r.id, r.amount, r.reason])).toEqual([
      [1, 15, wrote],
      [2, 5, echo],
    ])
  })

  it('adds a reward to one still waiting for the same reason', () => {
    const queue = build(
      { amount: 15, reason: wrote },
      { amount: 1, reason: echo },
      { amount: 1, reason: echo },
      { amount: 1, reason: echo },
    )
    expect(queue).toHaveLength(2)
    expect(queue[1]).toMatchObject({ id: 2, amount: 3, reason: echo })
  })

  it('never changes the number on the one already showing', () => {
    const queue = build({ amount: 1, reason: echo }, { amount: 1, reason: echo })
    expect(queue.map((r) => r.amount)).toEqual([1, 1])
  })

  it('buzzes a merged reward if either half asked', () => {
    const queue = build(
      { amount: 15, reason: wrote },
      { amount: 1, reason: echo },
      { amount: 1, reason: echo, haptic: true },
    )
    expect(queue[1]?.haptic).toBe(true)
    expect(build({ amount: 1, reason: echo })[0]?.haptic).toBe(false)
  })

  it('drops an amount that is not a positive whole number', () => {
    for (const amount of [0, -5, 1.5, NaN, Infinity]) {
      expect(build({ amount, reason: wrote })).toEqual([])
    }
  })

  it('does not change the queue it was given', () => {
    const before = build({ amount: 15, reason: wrote }, { amount: 1, reason: echo })
    const snapshot = structuredClone(before)
    enqueueReward(before, { amount: 1, reason: echo }, 9)
    enqueueReward(before, { amount: 0, reason: echo }, 10)
    expect(before).toEqual(snapshot)
  })
})

describe('finishReward', () => {
  it('takes the finished one off and moves the next up', () => {
    const queue = build({ amount: 15, reason: wrote }, { amount: 5, reason: echo })
    expect(finishReward(queue, 1).map((r) => r.id)).toEqual([2])
  })

  it('ignores an id it does not hold', () => {
    const queue = build({ amount: 15, reason: wrote })
    expect(finishReward(queue, 99)).toEqual(queue)
  })

  it('lets a reward for the same reason merge again once the head has gone', () => {
    let queue = build({ amount: 15, reason: wrote }, { amount: 1, reason: echo })
    queue = finishReward(queue, 1)
    // The Echo toast is now the head, on screen: a new one queues behind it.
    queue = enqueueReward(queue, { amount: 1, reason: echo }, 3)
    expect(queue.map((r) => [r.id, r.amount])).toEqual([
      [2, 1],
      [3, 1],
    ])
  })
})
