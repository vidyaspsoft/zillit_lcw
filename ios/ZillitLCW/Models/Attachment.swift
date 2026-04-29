import Foundation

/// Cross-platform Zillit attachment model. Server stores `media` and `thumbnail`
/// as S3 keys; `mediaUrl` / `thumbnailUrl` are presigned read URLs valid for
/// ~1 hour after the API response. `localFilePath` / `localThumbnailPath` are
/// populated by the client after the file is downloaded.
struct Attachment: Codable, Hashable {
    var bucket: String
    var region: String
    var contentType: String
    var contentSubtype: String
    var media: String
    var thumbnail: String
    var name: String
    var fileSize: String
    var width: Int
    var height: Int
    var duration: Int

    // Presigned read URLs returned by the server alongside `media`/`thumbnail`.
    var mediaUrl: String?
    var thumbnailUrl: String?

    // Local cache paths — filled in client-side after download.
    var localFilePath: String?
    var localThumbnailPath: String?

    enum CodingKeys: String, CodingKey {
        case bucket, region
        case contentType = "content_type"
        case contentSubtype = "content_subtype"
        case media, thumbnail, name
        case fileSize = "file_size"
        case width, height, duration
        case mediaUrl, thumbnailUrl
        case localFilePath, localThumbnailPath
    }

    /// Best URL to open in a viewer / share sheet.
    var bestURL: URL? {
        if let s = mediaUrl, let u = URL(string: s) { return u }
        return nil
    }
}
