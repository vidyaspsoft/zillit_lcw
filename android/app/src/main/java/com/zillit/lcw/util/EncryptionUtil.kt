package com.zillit.lcw.util

import javax.crypto.Cipher
import javax.crypto.spec.IvParameterSpec
import javax.crypto.spec.SecretKeySpec

/**
 * EncryptionUtil — AES-256-CBC encryption for the moduledata header.
 *
 * Matches the backend's `middleware/auth.js`:
 * - Algorithm: AES-256-CBC
 * - Manual PKCS5 padding (autoPadding disabled on backend)
 * - Output: **HEX string** (not base64)
 * - Key: last 32 chars of ENCRYPTION_KEY
 * - IV: first 16 chars of IV_KEY
 */
object EncryptionUtil {

    /**
     * Encrypt plainText using AES-256-CBC with manual PKCS5 padding.
     * Returns a lowercase hex string (matching crypto-js / Node.js backend format).
     */
    fun encrypt(plainText: String, encryptionKey: String, ivKey: String): String? {
        return try {
            val keyBytes = encryptionKey.toByteArray(Charsets.UTF_8)
            val ivBytes = ivKey.toByteArray(Charsets.UTF_8)

            require(keyBytes.size == 32) { "Key must be 32 bytes" }
            require(ivBytes.size == 16) { "IV must be 16 bytes" }

            val keySpec = SecretKeySpec(keyBytes, "AES")
            val ivSpec = IvParameterSpec(ivBytes)

            // Apply PKCS5 padding manually (backend uses setAutoPadding(false))
            val plainBytes = plainText.toByteArray(Charsets.UTF_8)
            val paddedBytes = applyPKCS5Padding(plainBytes)

            // Encrypt with NoPadding (we padded manually)
            val cipher = Cipher.getInstance("AES/CBC/NoPadding")
            cipher.init(Cipher.ENCRYPT_MODE, keySpec, ivSpec)
            val encrypted = cipher.doFinal(paddedBytes)

            // Output as lowercase hex string (NOT base64)
            encrypted.joinToString("") { "%02x".format(it) }
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    /**
     * Decrypt a hex-encoded ciphertext using AES-256-CBC.
     */
    fun decrypt(hexCipherText: String, encryptionKey: String, ivKey: String): String? {
        return try {
            val keyBytes = encryptionKey.toByteArray(Charsets.UTF_8)
            val ivBytes = ivKey.toByteArray(Charsets.UTF_8)

            val keySpec = SecretKeySpec(keyBytes, "AES")
            val ivSpec = IvParameterSpec(ivBytes)

            // Decode hex to bytes
            val encryptedBytes = hexCipherText.chunked(2).map { it.toInt(16).toByte() }.toByteArray()

            val cipher = Cipher.getInstance("AES/CBC/NoPadding")
            cipher.init(Cipher.DECRYPT_MODE, keySpec, ivSpec)
            val decryptedPadded = cipher.doFinal(encryptedBytes)

            // Remove PKCS5 padding
            val decrypted = removePKCS5Padding(decryptedPadded)
            String(decrypted, Charsets.UTF_8)
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    /**
     * PKCS5 padding: pad to 16-byte block boundary.
     * Matches backend's `applyPKCS5Padding()`.
     */
    private fun applyPKCS5Padding(data: ByteArray): ByteArray {
        val blockSize = 16
        val padLength = blockSize - (data.size % blockSize)
        val padded = ByteArray(data.size + padLength)
        System.arraycopy(data, 0, padded, 0, data.size)
        for (i in data.size until padded.size) {
            padded[i] = padLength.toByte()
        }
        return padded
    }

    /**
     * Remove PKCS5 padding.
     * Matches backend's `removePKCS5Padding()`.
     */
    private fun removePKCS5Padding(data: ByteArray): ByteArray {
        if (data.isEmpty()) throw IllegalArgumentException("Empty buffer")
        val padByte = data.last().toInt() and 0xFF
        if (padByte < 1 || padByte > 16) throw IllegalArgumentException("Invalid padding byte: $padByte")
        return data.copyOfRange(0, data.size - padByte)
    }
}
