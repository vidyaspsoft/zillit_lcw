package com.zillit.lcw.ui.boxschedule

import android.content.Intent
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.activity.viewModels
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.view.GravityCompat
import androidx.drawerlayout.widget.DrawerLayout
import androidx.fragment.app.Fragment
import com.zillit.lcw.R
import com.zillit.lcw.databinding.ActivityBoxScheduleBinding
import com.zillit.lcw.ui.boxschedule.calendar.CalendarFragment
import com.zillit.lcw.ui.boxschedule.create.CreateEventActivity
import com.zillit.lcw.ui.boxschedule.create.CreateScheduleActivity
import com.zillit.lcw.ui.boxschedule.history.HistoryActivity
import com.zillit.lcw.ui.boxschedule.list.ListFragment
import com.zillit.lcw.ui.boxschedule.share.ShareDialog
import com.zillit.lcw.ui.boxschedule.types.TypeManagerActivity
import com.zillit.lcw.ui.common.SetDefaultPopup
import com.zillit.lcw.ui.common.ThemeManager
import com.zillit.lcw.ui.login.LoginActivity
import com.zillit.lcw.util.DateUtils
import com.zillit.lcw.util.toColorInt

class BoxScheduleActivity : AppCompatActivity() {

    private lateinit var binding: ActivityBoxScheduleBinding
    val viewModel: BoxScheduleViewModel by viewModels()
    private var activeView = "calendar"

    private val viewDefaultKey = "box-schedule-default-view"

    // Single cached SharedPreferences instance to avoid repeated lookups on every setup fn
    private val prefs by lazy { getSharedPreferences("zillit_prefs", MODE_PRIVATE) }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityBoxScheduleBinding.inflate(layoutInflater)
        setContentView(binding.root)

        setupHeader()
        setupDrawer()
        setupViewToggle()
        observeViewModel()

        viewModel.loadAll()

        // Restore default view
        
        val savedView = prefs.getString(viewDefaultKey, "calendar") ?: "calendar"
        activeView = savedView

        if (savedInstanceState == null) {
            if (savedView == "list") {
                showFragment(ListFragment())
                binding.viewToggle.check(R.id.btnListView)
            } else {
                showFragment(CalendarFragment())
                binding.viewToggle.check(R.id.btnCalendarView)
            }
        }
    }

    private fun observeViewModel() {
        viewModel.errorMessage.observe(this) { message ->
            if (!message.isNullOrEmpty()) {
                Toast.makeText(this, message, Toast.LENGTH_SHORT).show()
            }
        }

        viewModel.isLoading.observe(this) { loading ->
            // Blocking overlay only on initial empty load; otherwise show non-blocking Refreshing pill
            val hasData = !viewModel.scheduleDays.value.isNullOrEmpty()
            binding.loadingOverlay.visibility = if (loading && !hasData) View.VISIBLE else View.GONE
            binding.refreshingIndicator.visibility = if (loading && hasData) View.VISIBLE else View.GONE
        }

        viewModel.scheduleTypes.observe(this) { types ->
            setupLegend(types)
        }
    }

    private fun setupHeader() {
        binding.tvPrepared.text = getString(R.string.bs_prepared, DateUtils.formatDate(System.currentTimeMillis()))

        // Back button
        binding.btnBack.setOnClickListener {
            
            prefs.edit().putBoolean("is_logged_in", false).apply()
            startActivity(Intent(this, LoginActivity::class.java))
            finish()
        }

        // Hamburger menu → open drawer
        binding.btnMenu.setOnClickListener {
            binding.drawerLayout.openDrawer(GravityCompat.END)
        }

        // Set Default for Calendar/List view → popup with options
        binding.btnSetDefaultView.setOnClickListener {
            
            val current = prefs.getString(viewDefaultKey, activeView) ?: activeView
            SetDefaultPopup.show(
                anchor = binding.btnSetDefaultView,
                title = getString(R.string.dv_choose_title),
                subtitle = getString(R.string.bs_set_default),
                options = listOf(
                    SetDefaultPopup.Option(
                        value = "calendar",
                        label = getString(R.string.bs_calendar_view),
                        description = getString(R.string.dv_calendar_desc),
                    ),
                    SetDefaultPopup.Option(
                        value = "list",
                        label = getString(R.string.bs_list_view),
                        description = getString(R.string.dv_list_desc),
                    ),
                ),
                currentValue = current,
                onSelect = { value ->
                    prefs.edit().putString(viewDefaultKey, value).apply()
                    val viewName = if (value == "calendar") getString(R.string.bs_calendar_view) else getString(R.string.bs_list_view)
                    Toast.makeText(this, getString(R.string.dv_default_set, viewName), Toast.LENGTH_SHORT).show()
                    if (value != activeView) {
                        activeView = value
                        if (value == "calendar") {
                            showFragment(CalendarFragment())
                            binding.viewToggle.check(R.id.btnCalendarView)
                        } else {
                            showFragment(ListFragment())
                            binding.viewToggle.check(R.id.btnListView)
                        }
                    }
                },
            )
        }
    }

    private fun setupDrawer() {
        // Close drawer button
        binding.btnCloseDrawer.setOnClickListener {
            binding.drawerLayout.closeDrawer(GravityCompat.END)
        }

        // Drawer items
        binding.drawerCreateSchedule.setOnClickListener {
            binding.drawerLayout.closeDrawer(GravityCompat.END)
            startActivity(Intent(this, CreateScheduleActivity::class.java))
        }

        binding.drawerCreateEvent.setOnClickListener {
            binding.drawerLayout.closeDrawer(GravityCompat.END)
            startActivity(Intent(this, CreateEventActivity::class.java).apply {
                putExtra("tab", "event")
            })
        }

        binding.drawerCreateNote.setOnClickListener {
            binding.drawerLayout.closeDrawer(GravityCompat.END)
            startActivity(Intent(this, CreateEventActivity::class.java).apply {
                putExtra("tab", "note")
            })
        }

        binding.drawerEditTypes.setOnClickListener {
            binding.drawerLayout.closeDrawer(GravityCompat.END)
            startActivity(Intent(this, TypeManagerActivity::class.java))
        }

        binding.drawerHistory.setOnClickListener {
            binding.drawerLayout.closeDrawer(GravityCompat.END)
            startActivity(Intent(this, HistoryActivity::class.java))
        }

        // Theme toggle
        val isDark = ThemeManager.isDark(this)
        binding.drawerThemeSwitch.isChecked = isDark
        binding.drawerThemeLabel.text = if (isDark) "Light Mode" else "Dark Mode"

        binding.drawerThemeToggle.setOnClickListener {
            binding.drawerLayout.closeDrawer(GravityCompat.END)
            ThemeManager.toggleTheme(this)
        }

        binding.drawerThemeSwitch.setOnCheckedChangeListener { _, _ ->
            binding.drawerLayout.closeDrawer(GravityCompat.END)
            ThemeManager.toggleTheme(this)
        }

        // User info in drawer footer
        
        val userName = prefs.getString("user_name", "User") ?: "User"
        binding.drawerUserName.text = userName
        binding.drawerUserInitial.text = userName.take(1).uppercase()

        binding.drawerLogout.setOnClickListener {
            binding.drawerLayout.closeDrawer(GravityCompat.END)
            prefs.edit().putBoolean("is_logged_in", false).apply()
            startActivity(Intent(this, LoginActivity::class.java))
            finish()
        }
    }

    private fun setupViewToggle() {
        binding.viewToggle.addOnButtonCheckedListener { _, checkedId, isChecked ->
            if (!isChecked) return@addOnButtonCheckedListener
            when (checkedId) {
                R.id.btnCalendarView -> {
                    activeView = "calendar"
                    showFragment(CalendarFragment())
                }
                R.id.btnListView -> {
                    activeView = "list"
                    showFragment(ListFragment())
                }
            }
        }
    }

    private fun setupLegend(types: List<com.zillit.lcw.data.model.ScheduleType> = emptyList()) {
        binding.legendContainer.removeAllViews()
        val maxVisible = 5
        val visible = types.take(maxVisible)
        val hiddenCount = (types.size - maxVisible).coerceAtLeast(0)

        for (type in visible) {
            val pill = LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
                setPadding(0, 0, dpToPx(10), 0)
            }

            val dot = View(this).apply {
                layoutParams = LinearLayout.LayoutParams(dpToPx(10), dpToPx(10)).apply { marginEnd = dpToPx(4) }
                background = ContextCompat.getDrawable(context, R.drawable.bg_schedule_pill)
                background.setTint(type.color.toColorInt())
            }

            val label = TextView(this).apply {
                text = type.title
                textSize = 11f
                setTextColor(ContextCompat.getColor(context, R.color.textSecondary))
            }

            pill.addView(dot)
            pill.addView(label)
            binding.legendContainer.addView(pill)
        }

        if (hiddenCount > 0) {
            val moreBtn = TextView(this).apply {
                text = getString(R.string.legend_more, hiddenCount)
                setTextColor(ContextCompat.getColor(context, R.color.textSecondary))
                textSize = 10f
                setPadding(dpToPx(8), dpToPx(3), dpToPx(8), dpToPx(3))
                background = ContextCompat.getDrawable(context, R.drawable.bg_button_secondary)
                setOnClickListener {
                    startActivity(Intent(this@BoxScheduleActivity, TypeManagerActivity::class.java))
                }
            }
            binding.legendContainer.addView(moreBtn)
        }
    }

    /** Called from CalendarFragment/ListFragment when a day is tapped */
    fun openDayDetail(dayKey: Long) {
        com.zillit.lcw.ui.boxschedule.detail.DayDetailActivity.launch(this, dayKey)
    }

    private fun showFragment(fragment: Fragment) {
        supportFragmentManager.beginTransaction()
            .replace(R.id.fragmentContainer, fragment)
            .commit()
    }

    override fun onResume() {
        super.onResume()
        viewModel.refreshAll()
    }

    override fun onBackPressed() {
        if (binding.drawerLayout.isDrawerOpen(GravityCompat.END)) {
            binding.drawerLayout.closeDrawer(GravityCompat.END)
        } else {
            super.onBackPressed()
        }
    }

    private fun dpToPx(dp: Int): Int = (dp * resources.displayMetrics.density).toInt()
}
