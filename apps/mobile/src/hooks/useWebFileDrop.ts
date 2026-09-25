import { useEffect, useRef, useState } from 'react'
import { Platform } from 'react-native'

/**
 * Files dragged from the desktop onto the page, on the web only.
 *
 * Listened for on `document` rather than on a drop target: the drop zone is
 * the whole conversation, the way it is in every desktop chat, and a target
 * that was only the composer would ask people to aim at a strip forty pixels
 * tall. `dragenter` and `dragleave` fire for every child the cursor crosses,
 * so a depth count is what tells "left the window" from "moved onto the
 * header".
 *
 * Text dragged inside the page — a selection — carries no `Files` type and is
 * left alone, so the browser keeps its own behaviour for it. Everything else
 * is `preventDefault`ed, because a browser's default for a dropped file is to
 * navigate to it and take the conversation with it.
 *
 * Native gets nothing: there is no desktop to drag from.
 */
export function useWebFileDrop(onDrop: (files: File[]) => void, enabled: boolean): boolean {
  const [dragging, setDragging] = useState(false)
  // The latest callback, without re-subscribing on every render of a screen
  // that re-renders on every keystroke.
  const onDropRef = useRef(onDrop)
  onDropRef.current = onDrop

  useEffect(() => {
    if (Platform.OS !== 'web' || !enabled || typeof document === 'undefined') return
    let depth = 0
    const carriesFiles = (event: DragEvent): boolean =>
      Array.from(event.dataTransfer?.types ?? []).includes('Files')
    const onEnter = (event: DragEvent) => {
      if (!carriesFiles(event)) return
      event.preventDefault()
      depth += 1
      setDragging(true)
    }
    const onOver = (event: DragEvent) => {
      if (!carriesFiles(event)) return
      event.preventDefault()
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
    }
    const onLeave = (event: DragEvent) => {
      if (!carriesFiles(event)) return
      depth = Math.max(0, depth - 1)
      if (depth === 0) setDragging(false)
    }
    const onDropEvent = (event: DragEvent) => {
      if (!carriesFiles(event)) return
      event.preventDefault()
      depth = 0
      setDragging(false)
      const files = Array.from(event.dataTransfer?.files ?? [])
      if (files.length > 0) onDropRef.current(files)
    }
    document.addEventListener('dragenter', onEnter)
    document.addEventListener('dragover', onOver)
    document.addEventListener('dragleave', onLeave)
    document.addEventListener('drop', onDropEvent)
    return () => {
      document.removeEventListener('dragenter', onEnter)
      document.removeEventListener('dragover', onOver)
      document.removeEventListener('dragleave', onLeave)
      document.removeEventListener('drop', onDropEvent)
      // Switched off mid-drag — the thread went read-only — the overlay must
      // not stay up with nothing listening for the drop that would clear it.
      setDragging(false)
    }
  }, [enabled])

  return dragging
}
