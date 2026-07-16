import AppKit
import AVFoundation

let inputURL = URL(fileURLWithPath: "/Users/milana/Desktop/execitive_ai/assets/video/executive-ai-demo.mp4")
let outputURL = URL(fileURLWithPath: "/Users/milana/Desktop/execitive_ai/assets/video/executive-ai-demo-poster.png")

let asset = AVURLAsset(url: inputURL)
let generator = AVAssetImageGenerator(asset: asset)
generator.appliesPreferredTrackTransform = true
generator.requestedTimeToleranceBefore = .zero
generator.requestedTimeToleranceAfter = .zero

var actualTime = CMTime.zero
let image = try generator.copyCGImage(
  at: CMTime(seconds: 0, preferredTimescale: 600),
  actualTime: &actualTime
)

let bitmap = NSBitmapImageRep(cgImage: image)
guard let data = bitmap.representation(using: .png, properties: [:]) else {
  throw NSError(domain: "PosterExtraction", code: 1)
}

try data.write(to: outputURL)
print("wrote \(outputURL.path) at \(CMTimeGetSeconds(actualTime))")
