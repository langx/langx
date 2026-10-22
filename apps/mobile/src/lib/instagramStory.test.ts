import { beforeEach, describe, expect, it, vi } from 'vitest'

const canOpenURL = vi.fn()
vi.mock('expo-linking', () => ({ canOpenURL }))

const isPackageInstalled = vi.fn()
const shareSingle = vi.fn()
vi.mock('react-native-share', () => ({
  Social: { InstagramStories: 'instagramstories' },
  default: {
    isPackageInstalled,
    shareSingle,
  },
}))

const { canShareToInstagramStory, shareVideoToInstagramStory } = await import('./instagramStory')

describe('canShareToInstagramStory', () => {
  beforeEach(() => vi.clearAllMocks())

  it('asks iOS about the stories scheme', async () => {
    canOpenURL.mockResolvedValue(true)
    expect(await canShareToInstagramStory('ios')).toBe(true)
    expect(canOpenURL).toHaveBeenCalledWith('instagram-stories://share')
  })

  it('asks Android about the Instagram package', async () => {
    isPackageInstalled.mockResolvedValue({ isInstalled: false, message: '' })
    expect(await canShareToInstagramStory('android')).toBe(false)
    expect(isPackageInstalled).toHaveBeenCalledWith('com.instagram.android')
  })

  it('says no on the web', async () => {
    expect(await canShareToInstagramStory('web')).toBe(false)
  })

  /** A build from before the native module throws here; that is a no, not a crash. */
  it('says no when the native side throws', async () => {
    isPackageInstalled.mockRejectedValue(new Error('RNShare is not linked'))
    expect(await canShareToInstagramStory('android')).toBe(false)
  })
})

describe('shareVideoToInstagramStory', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shares the file as the story background with the app id', async () => {
    shareSingle.mockResolvedValue({ success: true, message: '' })
    await shareVideoToInstagramStory('file:///cache/streak.mp4', 'meta-app')
    expect(shareSingle).toHaveBeenCalledWith({
      social: 'instagramstories',
      backgroundVideo: 'file:///cache/streak.mp4',
      appId: 'meta-app',
    })
  })

  it('refuses a remote URL', async () => {
    await expect(shareVideoToInstagramStory('https://x/streak.mp4', 'meta-app')).rejects.toThrow()
    expect(shareSingle).not.toHaveBeenCalled()
  })

  it('refuses an empty app id', async () => {
    await expect(shareVideoToInstagramStory('file:///cache/streak.mp4', '')).rejects.toThrow()
    expect(shareSingle).not.toHaveBeenCalled()
  })
})
