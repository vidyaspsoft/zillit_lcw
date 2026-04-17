import Foundation
import CommonCrypto

/// AES-256-CBC encryption for the moduledata header.
///
/// Matches backend `middleware/auth.js`:
/// - Algorithm: AES-256-CBC
/// - Manual PKCS5 padding (setAutoPadding(false) on backend)
/// - Output: **hex string** (not base64)
/// - Key: last 32 chars of ENCRYPTION_KEY
/// - IV: first 16 chars of IV_KEY
struct EncryptionUtil {

    // Derived from .env (same as backend)
    static let encryptionKey = "tuvwxyz123456789ABCDEFGHIJKLMNOP" // last 32 chars
    static let ivKey = "1234567890abcdef"                         // first 16 chars

    /// Encrypt plaintext using AES-256-CBC with manual PKCS5 padding.
    /// Returns a lowercase hex string (matching crypto-js / Node.js backend).
    static func encrypt(_ plainText: String) -> String? {
        guard let data = plainText.data(using: .utf8),
              let keyData = encryptionKey.data(using: .utf8),
              let ivData = ivKey.data(using: .utf8),
              keyData.count == 32,
              ivData.count == 16 else {
            return nil
        }

        // Apply PKCS5 padding manually
        let paddedData = applyPKCS5Padding(data)

        let bufferSize = paddedData.count + kCCBlockSizeAES128
        var buffer = Data(count: bufferSize)
        var numBytesEncrypted: size_t = 0

        let status = buffer.withUnsafeMutableBytes { bufferPtr in
            paddedData.withUnsafeBytes { dataPtr in
                keyData.withUnsafeBytes { keyPtr in
                    ivData.withUnsafeBytes { ivPtr in
                        CCCrypt(
                            CCOperation(kCCEncrypt),
                            CCAlgorithm(kCCAlgorithmAES),
                            0, // NO padding — we do it manually
                            keyPtr.baseAddress, kCCKeySizeAES256,
                            ivPtr.baseAddress,
                            dataPtr.baseAddress, paddedData.count,
                            bufferPtr.baseAddress, bufferSize,
                            &numBytesEncrypted
                        )
                    }
                }
            }
        }

        guard status == kCCSuccess else { return nil }
        buffer.count = numBytesEncrypted

        // Output as lowercase hex string (NOT base64)
        return buffer.map { String(format: "%02x", $0) }.joined()
    }

    /// Build the moduledata header payload and encrypt it.
    static func buildModuleDataHeader(userId: String, projectId: String, deviceId: String) -> String? {
        let payload: [String: Any] = [
            "device_id": deviceId,
            "project_id": projectId,
            "user_id": userId,
            "time_stamp": Int64(Date().timeIntervalSince1970 * 1000)
        ]

        guard let jsonData = try? JSONSerialization.data(withJSONObject: payload),
              let jsonString = String(data: jsonData, encoding: .utf8) else {
            return nil
        }

        return encrypt(jsonString)
    }

    // MARK: - PKCS5 Padding (matches backend)

    private static func applyPKCS5Padding(_ data: Data) -> Data {
        let blockSize = 16
        let padLength = blockSize - (data.count % blockSize)
        var padded = data
        padded.append(contentsOf: [UInt8](repeating: UInt8(padLength), count: padLength))
        return padded
    }
}
