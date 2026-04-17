package com.zillit.lcw.util

import android.content.Context
import android.graphics.Color
import android.widget.Toast

/**
 * Extension functions used throughout the app.
 */

// ── Color Utilities ──

/**
 * Parse a hex color string (e.g., "#FF0000") to an Android Color int.
 * Returns a default gray if parsing fails.
 */
fun String.toColorInt(): Int {
    return try {
        Color.parseColor(this)
    } catch (e: Exception) {
        Color.parseColor("#888888")
    }
}

/**
 * Lighten a color by mixing with white at the given ratio (0.0 = original, 1.0 = white).
 * Used for schedule pill backgrounds (e.g., 12% opacity effect).
 */
fun Int.lighten(factor: Float = 0.88f): Int {
    val r = Color.red(this)
    val g = Color.green(this)
    val b = Color.blue(this)
    return Color.rgb(
        (r + (255 - r) * factor).toInt().coerceIn(0, 255),
        (g + (255 - g) * factor).toInt().coerceIn(0, 255),
        (b + (255 - b) * factor).toInt().coerceIn(0, 255)
    )
}

/**
 * Apply alpha to a color (0-255).
 */
fun Int.withAlpha(alpha: Int): Int {
    return Color.argb(alpha, Color.red(this), Color.green(this), Color.blue(this))
}

// ── Toast ──

fun Context.showToast(message: String, length: Int = Toast.LENGTH_SHORT) {
    Toast.makeText(this, message, length).show()
}

// ── String ──

/**
 * Capitalize first letter only.
 */
fun String.capitalizeFirst(): String {
    return if (isNotEmpty()) this[0].uppercase() + substring(1) else this
}
