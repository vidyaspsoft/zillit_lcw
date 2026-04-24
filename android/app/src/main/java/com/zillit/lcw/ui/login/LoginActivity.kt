package com.zillit.lcw.ui.login

import android.content.Intent
import android.graphics.Color
import android.os.Bundle
import android.util.Log
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.zillit.lcw.R
import com.zillit.lcw.data.api.KtorClient
import com.zillit.lcw.data.model.ApiListResponse
import com.zillit.lcw.data.model.ProjectItem
import com.zillit.lcw.data.model.UserItem
import com.zillit.lcw.databinding.NewBoxActivityLoginBinding
import com.zillit.lcw.ui.boxschedule.BoxScheduleActivity
import com.zillit.lcw.ui.common.ThemeManager
import io.ktor.client.HttpClient
import io.ktor.client.call.*
import io.ktor.client.engine.android.Android
import io.ktor.client.plugins.HttpTimeout
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.plugins.logging.LogLevel
import io.ktor.client.plugins.logging.Logger
import io.ktor.client.plugins.logging.Logging
import io.ktor.client.request.*
import io.ktor.client.statement.HttpResponse
import io.ktor.client.statement.bodyAsText
import io.ktor.serialization.kotlinx.json.json
import kotlinx.coroutines.*
import kotlinx.serialization.json.Json

/**
 * LoginActivity — Select Project → Select User → Auto-login.
 * Fetches projects from GET /api/v2/auth/projects,
 * users from GET /api/v2/auth/projects/:id/users.
 */
class LoginActivity : AppCompatActivity() {

    private lateinit var binding: NewBoxActivityLoginBinding
    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())

    // Auth base URL (NOT box-schedule)
    private val authBaseUrl = "http://10.0.2.2:5003/api/v2/auth"

    companion object {
        private const val TAG = "LoginActivity"
        private const val KTOR_TAG = "KtorAuth"
    }

    // Single HttpClient reused across all auth requests (was previously re-created per call,
    // paying ~100-200ms of engine init per request).
    private val authClient: HttpClient by lazy {
        HttpClient(Android) {
            install(ContentNegotiation) { json(KtorClient.json) }
            install(HttpTimeout) {
                requestTimeoutMillis = 30_000
                connectTimeoutMillis = 15_000
                socketTimeoutMillis = 30_000
            }
            install(Logging) {
                logger = object : Logger {
                    override fun log(message: String) {
                        if (message.length > 3000) {
                            message.chunked(3000).forEach { Log.d(KTOR_TAG, it) }
                        } else {
                            Log.d(KTOR_TAG, message)
                        }
                    }
                }
                level = LogLevel.ALL
            }
        }
    }

    private var currentStep = "projects" // "projects" or "users"
    private var selectedProjectId = ""
    private var selectedProjectName = ""

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Check if already logged in
        val prefs = getSharedPreferences("zillit_prefs", MODE_PRIVATE)
        if (prefs.getBoolean("is_logged_in", false)) {
            startActivity(Intent(this, BoxScheduleActivity::class.java))
            finish()
            return
        }

        binding = NewBoxActivityLoginBinding.inflate(layoutInflater)
        setContentView(binding.root)

        binding.recyclerView.layoutManager = LinearLayoutManager(this)

        binding.btnThemeToggle.setOnClickListener { ThemeManager.toggleTheme(this) }

        binding.btnBackToProjects.setOnClickListener {
            currentStep = "projects"
            binding.btnBackToProjects.visibility = View.GONE
            binding.tvStepTitle.text = "SELECT PROJECT"
            fetchProjects()
        }

        fetchProjects()
    }

    private fun fetchProjects() {
        binding.progressBar.visibility = View.VISIBLE
        binding.tvError.visibility = View.GONE

        val url = "$authBaseUrl/projects"
        Log.d(TAG, "→ GET $url")

        scope.launch {
            try {
                val httpResponse: HttpResponse = authClient.get(url)
                val rawBody = httpResponse.bodyAsText()
                Log.d(TAG, "← ${httpResponse.status.value} ${httpResponse.status.description}")
                Log.d(TAG, "← body: $rawBody")

                val response = KtorClient.json.decodeFromString<ApiListResponse<ProjectItem>>(rawBody)
                val projects = response.data ?: emptyList()
                Log.d(TAG, "← parsed ${projects.size} project(s): ${projects.joinToString { it.name }}")

                binding.progressBar.visibility = View.GONE
                if (projects.isEmpty()) {
                    binding.tvError.text = "No projects returned (status=${response.status}, message=${response.message})"
                    binding.tvError.visibility = View.VISIBLE
                }
                binding.recyclerView.adapter = ProjectAdapter(projects) { project ->
                    selectedProjectId = project.id
                    selectedProjectName = project.name
                    currentStep = "users"
                    binding.tvStepTitle.text = "SELECT USER"
                    binding.btnBackToProjects.visibility = View.VISIBLE
                    binding.btnBackToProjects.text = "← ${project.name}"
                    fetchUsers(project.id)
                }
            } catch (e: Exception) {
                Log.e(TAG, "✗ fetchProjects failed", e)
                binding.progressBar.visibility = View.GONE
                binding.tvError.text = "Failed to load projects: ${e.message ?: e::class.simpleName}"
                binding.tvError.visibility = View.VISIBLE
            }
        }
    }

    private fun fetchUsers(projectId: String) {
        binding.progressBar.visibility = View.VISIBLE
        binding.tvError.visibility = View.GONE

        val url = "$authBaseUrl/projects/$projectId/users"
        Log.d(TAG, "→ GET $url")

        scope.launch {
            try {
                val httpResponse: HttpResponse = authClient.get(url)
                val rawBody = httpResponse.bodyAsText()
                Log.d(TAG, "← ${httpResponse.status.value} ${httpResponse.status.description}")
                Log.d(TAG, "← body: $rawBody")

                val response = KtorClient.json.decodeFromString<ApiListResponse<UserItem>>(rawBody)
                val users = response.data ?: emptyList()
                Log.d(TAG, "← parsed ${users.size} user(s): ${users.joinToString { it.name }}")

                binding.progressBar.visibility = View.GONE
                if (users.isEmpty()) {
                    binding.tvError.text = "No users returned (status=${response.status}, message=${response.message})"
                    binding.tvError.visibility = View.VISIBLE
                }
                binding.recyclerView.adapter = UserAdapter(users) { user ->
                    loginAs(user)
                }
            } catch (e: Exception) {
                Log.e(TAG, "✗ fetchUsers failed", e)
                binding.progressBar.visibility = View.GONE
                binding.tvError.text = "Failed to load users: ${e.message ?: e::class.simpleName}"
                binding.tvError.visibility = View.VISIBLE
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        authClient.close()
        scope.cancel()
    }

    private fun loginAs(user: UserItem) {
        val prefs = getSharedPreferences("zillit_prefs", MODE_PRIVATE)
        prefs.edit()
            .putString("user_id", user.id)
            .putString("project_id", selectedProjectId)
            .putString("user_name", user.name)
            .putString("device_id", android.provider.Settings.Secure.getString(contentResolver, android.provider.Settings.Secure.ANDROID_ID))
            .putBoolean("is_logged_in", true)
            .apply()

        startActivity(Intent(this, BoxScheduleActivity::class.java))
        finish()
    }


    // ═══════════════════════ ADAPTERS ═══════════════════════

    inner class ProjectAdapter(
        private val items: List<ProjectItem>,
        private val onClick: (ProjectItem) -> Unit
    ) : RecyclerView.Adapter<ProjectAdapter.VH>() {

        inner class VH(val layout: LinearLayout) : RecyclerView.ViewHolder(layout)

        override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): VH {
            val layout = LinearLayout(parent.context).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
                layoutParams = RecyclerView.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT
                ).apply { bottomMargin = dpToPx(8) }
                setPadding(dpToPx(14), dpToPx(14), dpToPx(14), dpToPx(14))
                background = ContextCompat.getDrawable(context, R.drawable.bg_card_rounded)
                isClickable = true
                isFocusable = true
            }
            return VH(layout)
        }

        override fun onBindViewHolder(holder: VH, position: Int) {
            val project = items[position]
            holder.layout.removeAllViews()

            // Icon
            val icon = ImageView(holder.layout.context).apply {
                layoutParams = LinearLayout.LayoutParams(dpToPx(40), dpToPx(40)).apply { marginEnd = dpToPx(12) }
                setImageResource(android.R.drawable.ic_menu_agenda)
                setColorFilter(ContextCompat.getColor(context, R.color.primaryAccent))
                setPadding(dpToPx(8), dpToPx(8), dpToPx(8), dpToPx(8))
                setBackgroundColor(ContextCompat.getColor(context, R.color.primaryAccent) and 0x1AFFFFFF)
            }

            // Name
            val name = TextView(holder.layout.context).apply {
                text = project.name
                textSize = 15f
                setTextColor(ContextCompat.getColor(context, R.color.textPrimary))
                typeface = android.graphics.Typeface.DEFAULT_BOLD
                layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f)
            }

            // Chevron
            val chevron = TextView(holder.layout.context).apply {
                text = "›"
                textSize = 20f
                setTextColor(ContextCompat.getColor(context, R.color.textPlaceholder))
            }

            holder.layout.addView(icon)
            holder.layout.addView(name)
            holder.layout.addView(chevron)
            holder.layout.setOnClickListener { onClick(project) }
        }

        override fun getItemCount() = items.size
    }

    inner class UserAdapter(
        private val items: List<UserItem>,
        private val onClick: (UserItem) -> Unit
    ) : RecyclerView.Adapter<UserAdapter.VH>() {

        inner class VH(val layout: LinearLayout) : RecyclerView.ViewHolder(layout)

        override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): VH {
            val layout = LinearLayout(parent.context).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
                layoutParams = RecyclerView.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT
                ).apply { bottomMargin = dpToPx(8) }
                setPadding(dpToPx(14), dpToPx(14), dpToPx(14), dpToPx(14))
                background = ContextCompat.getDrawable(context, R.drawable.bg_card_rounded)
                isClickable = true
                isFocusable = true
            }
            return VH(layout)
        }

        override fun onBindViewHolder(holder: VH, position: Int) {
            val user = items[position]
            holder.layout.removeAllViews()

            // Avatar circle with initial
            val avatar = TextView(holder.layout.context).apply {
                text = user.name.take(1).uppercase()
                textSize = 16f
                setTextColor(ContextCompat.getColor(context, R.color.primaryAccent))
                typeface = android.graphics.Typeface.DEFAULT_BOLD
                gravity = Gravity.CENTER
                layoutParams = LinearLayout.LayoutParams(dpToPx(40), dpToPx(40)).apply { marginEnd = dpToPx(12) }
                setBackgroundColor(ContextCompat.getColor(context, R.color.primaryAccent) and 0x1AFFFFFF)
            }

            // Name + role column
            val infoCol = LinearLayout(holder.layout.context).apply {
                orientation = LinearLayout.VERTICAL
                layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f)
            }

            val nameView = TextView(holder.layout.context).apply {
                text = user.name
                textSize = 15f
                setTextColor(ContextCompat.getColor(context, R.color.textPrimary))
                typeface = android.graphics.Typeface.DEFAULT_BOLD
            }

            val roleView = TextView(holder.layout.context).apply {
                text = user.role.uppercase()
                textSize = 10f
                setTextColor(
                    if (user.role == "admin") ContextCompat.getColor(context, R.color.primaryAccent)
                    else ContextCompat.getColor(context, R.color.textMuted)
                )
                typeface = android.graphics.Typeface.DEFAULT_BOLD
            }

            infoCol.addView(nameView)
            infoCol.addView(roleView)

            // Arrow
            val arrow = TextView(holder.layout.context).apply {
                text = "→"
                textSize = 18f
                setTextColor(ContextCompat.getColor(context, R.color.primaryAccent))
            }

            holder.layout.addView(avatar)
            holder.layout.addView(infoCol)
            holder.layout.addView(arrow)
            holder.layout.setOnClickListener { onClick(user) }
        }

        override fun getItemCount() = items.size
    }

    private fun dpToPx(dp: Int): Int = (dp * resources.displayMetrics.density).toInt()
}
