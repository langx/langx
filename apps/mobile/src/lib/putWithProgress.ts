/**
 * A presigned PUT that says how far along it is.
 *
 * The only `XMLHttpRequest` in the app, and the reason is narrow: `fetch` has
 * no upload progress and React Native has no streaming request bodies, so
 * `xhr.upload.onprogress` is the only way to know. Both platforms have a real
 * one — RN implements XHR natively, the browser obviously does.
 *
 * Scoped to this single call on purpose. The presigned PUT goes straight to
 * the bucket and never touches `apiFetch`, so nothing about cookies, base URLs
 * or error shapes has to be reimplemented here.
 */
export function putWithProgress(options: {
  url: string
  body: Blob
  contentType: string
  onProgress?: (loaded: number, total: number) => void
}): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open('PUT', options.url)
    // Must match the signed content type exactly or the signature is rejected.
    request.setRequestHeader('Content-Type', options.contentType)

    request.upload.onprogress = (event) => {
      options.onProgress?.(event.loaded, event.lengthComputable ? event.total : 0)
    }
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) resolve()
      else reject(new Error(`Upload failed (${request.status})`))
    }
    // No status to report: the request never reached the bucket. Same message
    // shape as above so callers have one thing to catch.
    request.onerror = () => reject(new Error('Upload failed (network)'))
    request.onabort = () => reject(new Error('Upload failed (aborted)'))

    request.send(options.body)
  })
}
