package expo.modules.videofilter

import android.net.Uri
import android.os.Handler
import android.os.Looper
import androidx.annotation.OptIn
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.common.util.UnstableApi
import androidx.media3.effect.SingleColorLut
import androidx.media3.transformer.Composition
import androidx.media3.transformer.DefaultEncoderFactory
import androidx.media3.transformer.EditedMediaItem
import androidx.media3.transformer.Effects
import androidx.media3.transformer.ExportException
import androidx.media3.transformer.ExportResult
import androidx.media3.transformer.Transformer
import androidx.media3.transformer.VideoEncoderSettings
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.util.UUID
import kotlin.math.roundToInt

/**
 * The camera filter drawn into a recorded clip. See `index.ts`.
 *
 * The matrix becomes a 3D lookup table rather than Media3's `RgbMatrix`,
 * which takes four weights per channel and no offset — and three of the
 * filters lift their blacks with one. Computing every output from the matrix
 * keeps the offsets, and the clamp to 0…1 Skia applies, exactly; 33 steps a
 * side is the size colour grading uses, fine enough that the interpolation
 * between them does not show.
 *
 * Media3 works on the encoded values of SDR video by default (since 1.4), as
 * Skia does on a photo, so the same numbers mean the same thing here too.
 */
@OptIn(UnstableApi::class)
class VideoFilterModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("VideoFilter")

    AsyncFunction("apply") { uri: String, matrix: List<Double>, bitrate: Int, promise: Promise ->
      if (matrix.size != 20) {
        promise.reject(CodedException("ERR_VIDEO_FILTER", "Expected a 4x5 colour matrix", null))
        return@AsyncFunction
      }
      val context = appContext.reactContext
      if (context == null) {
        promise.reject(CodedException("ERR_VIDEO_FILTER", "No context to run in", null))
        return@AsyncFunction
      }
      val output = File(context.cacheDir, "filtered-${UUID.randomUUID()}.mp4")
      val lut = SingleColorLut.createFromCube(cube(matrix))

      // Transformer must be built, started and heard from on a thread with a looper.
      Handler(Looper.getMainLooper()).post {
        val encoders = DefaultEncoderFactory.Builder(context)
          .setRequestedVideoEncoderSettings(
            VideoEncoderSettings.Builder().setBitrate(bitrate).build(),
          )
          .build()
        val transformer = Transformer.Builder(context)
          .setVideoMimeType(MimeTypes.VIDEO_H264)
          .setEncoderFactory(encoders)
          .addListener(object : Transformer.Listener {
            override fun onCompleted(composition: Composition, exportResult: ExportResult) {
              promise.resolve(Uri.fromFile(output).toString())
            }

            override fun onError(
              composition: Composition,
              exportResult: ExportResult,
              exportException: ExportException,
            ) {
              output.delete()
              promise.reject(
                CodedException("ERR_VIDEO_FILTER", exportException.message, exportException),
              )
            }
          })
          .build()
        val item = EditedMediaItem.Builder(MediaItem.fromUri(uri))
          .setEffects(Effects(listOf(), listOf(lut)))
          .build()
        transformer.start(item, output.absolutePath)
      }
    }
  }

  private fun cube(matrix: List<Double>): Array<Array<IntArray>> {
    val last = (LUT_SIZE - 1).toDouble()
    return Array(LUT_SIZE) { r ->
      Array(LUT_SIZE) { g ->
        IntArray(LUT_SIZE) { b ->
          val input = doubleArrayOf(r / last, g / last, b / last, 1.0)
          var color = 0xFF shl 24
          for (channel in 0 until 3) {
            var value = matrix[channel * 5 + 4]
            for (k in 0 until 4) value += matrix[channel * 5 + k] * input[k]
            val byte = (value.coerceIn(0.0, 1.0) * 255).roundToInt()
            color = color or (byte shl (16 - channel * 8))
          }
          color
        }
      }
    }
  }

  private companion object {
    const val LUT_SIZE = 33
  }
}
