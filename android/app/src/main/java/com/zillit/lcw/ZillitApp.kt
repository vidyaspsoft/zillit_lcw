package com.zillit.lcw

import android.app.Application
import androidx.appcompat.app.AppCompatDelegate

class ZillitApp : Application() {

    override fun onCreate() {
        super.onCreate()

        // Read saved theme preference (matches web's 'cnc-theme' key)
        val prefs = getSharedPreferences("zillit_prefs", MODE_PRIVATE)
        val savedTheme = prefs.getString("cnc-theme", "dark") // Default: dark

        when (savedTheme) {
            "dark" -> AppCompatDelegate.setDefaultNightMode(AppCompatDelegate.MODE_NIGHT_YES)
            "light" -> AppCompatDelegate.setDefaultNightMode(AppCompatDelegate.MODE_NIGHT_NO)
            else -> AppCompatDelegate.setDefaultNightMode(AppCompatDelegate.MODE_NIGHT_YES)
        }
    }
}
