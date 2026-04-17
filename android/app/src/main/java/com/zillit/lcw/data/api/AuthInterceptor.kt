package com.zillit.lcw.data.api

import android.content.Context
import com.zillit.lcw.util.EncryptionUtil
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

/**
 * AuthInterceptor — builds the AES-256-CBC encrypted `moduledata` header.
 *
 * Key derivation matches backend middleware/auth.js:
 *   key = ENCRYPTION_KEY.slice(-32)  →  last 32 chars
 *   iv  = IV_KEY.slice(0, 16)        →  first 16 chars
 * Output: hex string (not base64)
 */
object AuthInterceptor {

    // Derived from .env — same values the backend uses
    // ENCRYPTION_KEY = "abcdefghijklmnopqrstuvwxyz123456789ABCDEFGHIJKLMNOP"
    // IV_KEY = "1234567890abcdef1234567890abcdef"
    private const val ENCRYPTION_KEY = "tuvwxyz123456789ABCDEFGHIJKLMNOP" // last 32 chars
    private const val IV_KEY = "1234567890abcdef"                        // first 16 chars

    /**
     * Build the encrypted moduledata header value.
     *
     * @param userId Current user's ID
     * @param projectId Current project's ID
     * @param deviceId Unique device identifier
     * @return Hex-encoded encrypted string for the `moduledata` header
     */
    fun buildModuleDataHeader(userId: String, projectId: String, deviceId: String): String? {
        val payload = buildJsonObject {
            put("device_id", deviceId)
            put("project_id", projectId)
            put("user_id", userId)
            put("time_stamp", System.currentTimeMillis())
        }.toString()

        return EncryptionUtil.encrypt(payload, ENCRYPTION_KEY, IV_KEY)
    }

    /**
     * Read stored auth credentials from SharedPreferences.
     */
    fun getStoredCredentials(context: Context): Triple<String, String, String>? {
        val prefs = context.getSharedPreferences("zillit_prefs", Context.MODE_PRIVATE)
        val userId = prefs.getString("user_id", null) ?: return null
        val projectId = prefs.getString("project_id", null) ?: return null
        val deviceId = prefs.getString("device_id", null)
            ?: android.provider.Settings.Secure.getString(context.contentResolver, android.provider.Settings.Secure.ANDROID_ID)
            ?: "android-default"
        return Triple(userId, projectId, deviceId)
    }
}
