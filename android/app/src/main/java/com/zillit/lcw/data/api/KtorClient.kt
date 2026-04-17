package com.zillit.lcw.data.api

import android.content.Context
import android.util.Log
import io.ktor.client.*
import io.ktor.client.engine.android.*
import io.ktor.client.plugins.*
import io.ktor.client.plugins.contentnegotiation.*
import io.ktor.client.plugins.logging.*
import io.ktor.client.request.*
import io.ktor.http.*
import io.ktor.serialization.kotlinx.json.*
import kotlinx.serialization.json.Json

/**
 * KtorClient — singleton HTTP client with:
 * - Kotlinx Serialization (JsonBuilder) for JSON parsing
 * - Ktor Logging plugin → visible in Logcat as "KtorLogger"
 * - Auto-injected `moduledata` header on every request (AES-256-CBC encrypted)
 * - Content negotiation for auto-serialization
 */
object KtorClient {

    private const val TAG = "KtorLogger"

    // 10.0.2.2 = host machine from Android emulator
    const val BASE_URL = "http://10.0.2.2:5003/api/v2/box-schedule"

    val json = Json {
        ignoreUnknownKeys = true
        isLenient = true
        prettyPrint = true
        encodeDefaults = true
        coerceInputValues = true
    }

    /**
     * Create an HttpClient with auth header injection.
     * Must be called with a Context so we can read stored credentials.
     */
    fun create(context: Context): HttpClient {
        return HttpClient(Android) {
            // JSON Content Negotiation (JsonBuilder)
            install(ContentNegotiation) {
                json(json)
            }

            // Request/Response Logging — visible in Logcat with tag "KtorLogger"
            install(Logging) {
                logger = object : Logger {
                    override fun log(message: String) {
                        // Split long messages for Logcat (max ~4000 chars per line)
                        if (message.length > 3000) {
                            Log.d(TAG, "┌──────────────────────────────────")
                            message.chunked(3000).forEach { Log.d(TAG, "│ $it") }
                            Log.d(TAG, "└──────────────────────────────────")
                        } else {
                            Log.d(TAG, message)
                        }
                    }
                }
                level = LogLevel.ALL // Log headers + body for debugging
            }

            // Timeouts
            install(HttpTimeout) {
                requestTimeoutMillis = 30_000
                connectTimeoutMillis = 15_000
                socketTimeoutMillis = 30_000
            }

            // Default request config
            defaultRequest {
                url(BASE_URL)
                contentType(ContentType.Application.Json)

                // Inject moduledata auth header on every request
                val credentials = AuthInterceptor.getStoredCredentials(context)
                if (credentials != null) {
                    val (userId, projectId, deviceId) = credentials
                    val moduleData = AuthInterceptor.buildModuleDataHeader(userId, projectId, deviceId)
                    if (moduleData != null) {
                        header("moduledata", moduleData)
                        Log.d(TAG, "🔐 moduledata header injected (${moduleData.length} chars)")
                    }
                }
            }
        }
    }
}
