package com.zillit.lcw.ui.common

import android.content.Context
import android.content.SharedPreferences
import androidx.appcompat.app.AppCompatDelegate

/**
 * ThemeManager — controls dark/light theme.
 * Shares the same localStorage key as the web app ('cnc-theme')
 * so the preference syncs conceptually across platforms.
 */
object ThemeManager {

    private const val PREFS_NAME = "zillit_prefs"
    private const val KEY_THEME = "cnc-theme"

    fun isDark(context: Context): Boolean {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        return prefs.getString(KEY_THEME, "dark") == "dark"
    }

    fun toggleTheme(context: Context) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val current = prefs.getString(KEY_THEME, "dark")
        val newTheme = if (current == "dark") "light" else "dark"
        prefs.edit().putString(KEY_THEME, newTheme).apply()

        when (newTheme) {
            "dark" -> AppCompatDelegate.setDefaultNightMode(AppCompatDelegate.MODE_NIGHT_YES)
            "light" -> AppCompatDelegate.setDefaultNightMode(AppCompatDelegate.MODE_NIGHT_NO)
        }
    }

    fun setTheme(context: Context, mode: String) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().putString(KEY_THEME, mode).apply()

        when (mode) {
            "dark" -> AppCompatDelegate.setDefaultNightMode(AppCompatDelegate.MODE_NIGHT_YES)
            "light" -> AppCompatDelegate.setDefaultNightMode(AppCompatDelegate.MODE_NIGHT_NO)
        }
    }
}
