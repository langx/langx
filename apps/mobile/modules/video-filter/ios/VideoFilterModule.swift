import AVFoundation
import CoreImage
import ExpoModulesCore

/**
 The camera filter drawn into a recorded clip. See `index.ts`.

 A reader → writer pass rather than `AVAssetExportSession`: the export
 presets pick their own bitrate, and at 1080p theirs is two or three times
 the camera's 5 Mbps — a minute of it would no longer fit under the upload
 ceiling the camera's own clip was sized for. The writer takes the bitrate
 the camera recorded at instead.
 */
public class VideoFilterModule: Module {
  public func definition() -> ModuleDefinition {
    Name("VideoFilter")

    AsyncFunction("apply") { (uri: String, matrix: [Double], bitrate: Int, promise: Promise) in
      guard matrix.count == 20, let source = URL(string: uri), source.isFileURL else {
        promise.reject("ERR_VIDEO_FILTER", "Expected a file URI and a 4x5 colour matrix")
        return
      }
      let caches = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
      let output = caches.appendingPathComponent("filtered-\(UUID().uuidString).mp4")
      FilterPass(source: source, output: output, matrix: matrix, bitrate: bitrate).run { error in
        if let error {
          try? FileManager.default.removeItem(at: output)
          promise.reject("ERR_VIDEO_FILTER", error.localizedDescription)
        } else {
          promise.resolve(output.absoluteString)
        }
      }
    }
  }
}

private enum FilterError: LocalizedError {
  case noVideo
  case failed(String)

  var errorDescription: String? {
    switch self {
    case .noVideo: return "The file has no video track"
    case .failed(let step): return "The filter pass failed at \(step)"
    }
  }
}

private final class FilterPass {
  let source: URL
  let output: URL
  let matrix: [Double]
  let bitrate: Int

  init(source: URL, output: URL, matrix: [Double], bitrate: Int) {
    self.source = source
    self.output = output
    self.matrix = matrix
    self.bitrate = bitrate
  }

  func run(done: @escaping (Error?) -> Void) {
    do {
      let asset = AVURLAsset(url: source)
      guard let videoTrack = asset.tracks(withMediaType: .video).first else {
        throw FilterError.noVideo
      }
      let audioTrack = asset.tracks(withMediaType: .audio).first

      // Skia's layout: row-major, one row per output channel, four weights then an offset.
      let m = matrix.map { CGFloat($0) }
      let parameters: [String: Any] = [
        "inputRVector": CIVector(x: m[0], y: m[1], z: m[2], w: m[3]),
        "inputGVector": CIVector(x: m[5], y: m[6], z: m[7], w: m[8]),
        "inputBVector": CIVector(x: m[10], y: m[11], z: m[12], w: m[13]),
        "inputAVector": CIVector(x: m[15], y: m[16], z: m[17], w: m[18]),
        "inputBiasVector": CIVector(x: m[4], y: m[9], z: m[14], w: m[19]),
      ]
      /*
       Core Image works in linear light, Skia — which draws the preview and
       bakes the photos — on the encoded values. Going out to sRGB's curve
       for the matrix and back makes the same numbers mean the same thing,
       so the clip looks as the preview did. The clamp is Skia's too: an
       offset can push a channel past 1, and the curve back would stretch it.
       The composition hands each frame over already turned upright.
       */
      let composition = AVMutableVideoComposition(asset: asset) { request in
        let frame = request.sourceImage
        let graded = frame
          .applyingFilter("CILinearToSRGBToneCurve")
          .applyingFilter("CIColorMatrix", parameters: parameters)
          .applyingFilter("CIColorClamp")
          .applyingFilter("CISRGBToneCurveToLinear")
          .cropped(to: frame.extent)
        request.finish(with: graded, context: nil)
      }

      let reader = try AVAssetReader(asset: asset)
      let videoOut = AVAssetReaderVideoCompositionOutput(
        videoTracks: [videoTrack],
        videoSettings: [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA]
      )
      videoOut.videoComposition = composition
      videoOut.alwaysCopiesSampleData = false
      reader.add(videoOut)

      let writer = try AVAssetWriter(outputURL: output, fileType: .mp4)
      writer.shouldOptimizeForNetworkUse = true
      let size = composition.renderSize
      let videoIn = AVAssetWriterInput(
        mediaType: .video,
        outputSettings: [
          AVVideoCodecKey: AVVideoCodecType.h264,
          AVVideoWidthKey: Int(size.width),
          AVVideoHeightKey: Int(size.height),
          AVVideoCompressionPropertiesKey: [
            AVVideoAverageBitRateKey: bitrate,
            AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel,
          ],
        ]
      )
      videoIn.expectsMediaDataInRealTime = false
      writer.add(videoIn)

      /*
       The sound is copied, not re-encoded: the camera already wrote AAC. Its
       output joins the reader only if the writer takes it — an output left
       unread would stall the reader behind it.
       */
      var audio: (out: AVAssetReaderTrackOutput, input: AVAssetWriterInput)?
      if let audioTrack {
        let out = AVAssetReaderTrackOutput(track: audioTrack, outputSettings: nil)
        out.alwaysCopiesSampleData = false
        let hint = audioTrack.formatDescriptions.first.map { $0 as! CMFormatDescription }
        let input = AVAssetWriterInput(mediaType: .audio, outputSettings: nil, sourceFormatHint: hint)
        input.expectsMediaDataInRealTime = false
        if reader.canAdd(out) && writer.canAdd(input) {
          reader.add(out)
          writer.add(input)
          audio = (out, input)
        }
      }

      guard reader.startReading() else { throw reader.error ?? FilterError.failed("reading") }
      guard writer.startWriting() else { throw writer.error ?? FilterError.failed("writing") }
      writer.startSession(atSourceTime: .zero)

      let group = DispatchGroup()
      pump(videoOut, into: videoIn, label: "video", group: group)
      if let audio {
        pump(audio.out, into: audio.input, label: "audio", group: group)
      }

      group.notify(queue: .global(qos: .userInitiated)) {
        if reader.status == .failed {
          writer.cancelWriting()
          done(reader.error ?? FilterError.failed("reading"))
          return
        }
        writer.finishWriting {
          done(writer.status == .completed ? nil : writer.error ?? FilterError.failed("finishing"))
        }
      }
    } catch {
      done(error)
    }
  }

  private func pump(
    _ output: AVAssetReaderOutput,
    into input: AVAssetWriterInput,
    label: String,
    group: DispatchGroup
  ) {
    group.enter()
    var finished = false
    let queue = DispatchQueue(label: "langx.videofilter.\(label)")
    input.requestMediaDataWhenReady(on: queue) {
      while input.isReadyForMoreMediaData && !finished {
        guard let buffer = output.copyNextSampleBuffer(), input.append(buffer) else {
          finished = true
          input.markAsFinished()
          group.leave()
          return
        }
      }
    }
  }
}
