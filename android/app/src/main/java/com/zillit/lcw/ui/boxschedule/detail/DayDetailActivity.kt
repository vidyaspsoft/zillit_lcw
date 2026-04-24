package com.zillit.lcw.ui.boxschedule.detail

import android.content.Context
import android.content.Intent
import android.content.res.ColorStateList
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.LinearLayout
import android.widget.TextView
import androidx.activity.viewModels
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.widget.TextViewCompat
import com.zillit.lcw.R
import com.zillit.lcw.data.model.ScheduleDay
import com.zillit.lcw.data.model.ScheduleEvent
import com.zillit.lcw.databinding.NewBoxActivityDayDetailBinding
import com.zillit.lcw.ui.boxschedule.BoxScheduleViewModel
import com.zillit.lcw.ui.boxschedule.create.CreateEventActivity
import com.zillit.lcw.ui.boxschedule.create.CreateScheduleActivity
import com.zillit.lcw.util.DateUtils
import com.zillit.lcw.util.toColorInt

/**
 * DayDetailActivity — full-screen day detail matching web's ScheduleDayDetail.
 * Shows schedules with Edit/Delete, events with Edit/Remove, notes with Delete,
 * Add Schedule + Add Event + Add Note buttons, delete confirmations.
 */
class DayDetailActivity : AppCompatActivity() {

    private lateinit var binding: NewBoxActivityDayDetailBinding
    private val viewModel: BoxScheduleViewModel by viewModels()
    private var dayMs: Long = 0L

    companion object {
        private const val EXTRA_DAY_MS = "day_ms"
        fun launch(context: Context, dayMs: Long) {
            context.startActivity(Intent(context, DayDetailActivity::class.java).apply {
                putExtra(EXTRA_DAY_MS, dayMs)
            })
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = NewBoxActivityDayDetailBinding.inflate(layoutInflater)
        setContentView(binding.root)

        dayMs = intent.getLongExtra(EXTRA_DAY_MS, System.currentTimeMillis())

        setSupportActionBar(binding.toolbar)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)
        supportActionBar?.title = DateUtils.formatFullDay(dayMs)
        binding.toolbar.setNavigationOnClickListener { finish() }

        viewModel.loadAll()

        setupDateHeader()
        setupActionButtons()
        observeData()
    }

    private fun setupDateHeader() {
        val dayNum = java.util.Calendar.getInstance().apply { timeInMillis = dayMs }.get(java.util.Calendar.DAY_OF_MONTH)
        binding.tvDayNumber.text = dayNum.toString()
        binding.tvDayName.text = DateUtils.formatDayName(dayMs)
        binding.tvMonthYear.text = DateUtils.formatDate(dayMs)

        if (DateUtils.isToday(dayMs)) {
            binding.todayBadge.visibility = View.VISIBLE
            binding.tvDayNumber.setTextColor(ContextCompat.getColor(this, R.color.calTodayText))
            binding.dayNumberCircle.visibility = View.VISIBLE
        }

        if (DateUtils.isPast(dayMs)) {
            binding.pastBadge.visibility = View.VISIBLE
            binding.actionButtons.visibility = View.GONE
        }
    }

    private fun setupActionButtons() {
        val isPast = DateUtils.isPast(dayMs)
        if (isPast) return

        // Feature 1: Pass locked date to CreateSchedule
        binding.btnAddSchedule.setOnClickListener {
            CreateScheduleActivity.launchForDate(this, dayMs)
        }
        binding.btnAddEvent.setOnClickListener {
            startActivity(Intent(this, CreateEventActivity::class.java).apply {
                putExtra("tab", "event")
            })
        }
    }

    private fun observeData() {
        // Use calendarData — it includes nested events & notes on each ScheduleDay.
        // scheduleDays (from /days endpoint) has empty events/notes arrays.
        viewModel.calendarData.observe(this) { days ->
            if (!days.isNullOrEmpty()) populateSchedules(days)
        }
        viewModel.scheduleDays.observe(this) { days ->
            // Fallback only if calendarData hasn't arrived yet.
            if (viewModel.calendarData.value.isNullOrEmpty()) populateSchedules(days)
        }
    }

    private fun populateSchedules(allDays: List<ScheduleDay>) {
        val dayStart = DateUtils.startOfDayMs(dayMs)
        val isPast = DateUtils.isPast(dayMs)

        // Match on explicit calendarDays only (same as iOS/web). Range fallback was overmatching.
        val matchingSchedules = allDays.filter { sd ->
            sd.calendarDays.any { DateUtils.startOfDayMs(it) == dayStart }
        }

        // Schedule pills
        binding.schedulePillsContainer.removeAllViews()
        if (matchingSchedules.isEmpty()) {
            binding.emptyState.visibility = View.VISIBLE
            return
        }
        binding.emptyState.visibility = View.GONE

        for (schedule in matchingSchedules) {
            val card = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                layoutParams = LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT
                ).apply { bottomMargin = dpToPx(8) }
                val bg = GradientDrawable().apply {
                    setColor(schedule.color.toColorInt() and 0x0FFFFFFF or 0x10000000)
                    cornerRadius = dpToPx(8).toFloat()
                    setStroke(1, schedule.color.toColorInt() and 0x33FFFFFF or 0x33000000)
                }
                background = bg
            }

            // Info row
            val infoRow = LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
                setPadding(dpToPx(12), dpToPx(10), dpToPx(12), dpToPx(10))
            }

            val dot = View(this).apply {
                layoutParams = LinearLayout.LayoutParams(dpToPx(12), dpToPx(12)).apply { marginEnd = dpToPx(8) }
                val dotBg = GradientDrawable().apply { shape = GradientDrawable.OVAL; setColor(schedule.color.toColorInt()) }
                background = dotBg
            }

            val infoCol = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f)
            }

            infoCol.addView(TextView(this).apply {
                text = schedule.typeName; textSize = 14f; setTextColor(ContextCompat.getColor(context, R.color.textPrimary))
                typeface = android.graphics.Typeface.DEFAULT_BOLD
            })

            if (schedule.title.isNotEmpty()) {
                infoCol.addView(TextView(this).apply {
                    text = "\"${schedule.title}\""; textSize = 12f
                    setTextColor(ContextCompat.getColor(context, R.color.textSecondary))
                    typeface = android.graphics.Typeface.create("serif", android.graphics.Typeface.NORMAL)
                })
            }

            infoCol.addView(TextView(this).apply {
                text = "${schedule.numberOfDays} day(s) · ${DateUtils.formatShortDate(schedule.startDate)} – ${DateUtils.formatDate(schedule.endDate)}"
                textSize = 11f; setTextColor(ContextCompat.getColor(context, R.color.textMuted))
            })

            infoRow.addView(dot)
            infoRow.addView(infoCol)
            card.addView(infoRow)

            // Edit + Delete row (matching web)
            if (!isPast) {
                val divider = View(this).apply {
                    layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 1)
                    setBackgroundColor(ContextCompat.getColor(context, R.color.borderLight))
                }
                card.addView(divider)

                val actionsRow = LinearLayout(this).apply {
                    orientation = LinearLayout.HORIZONTAL
                    gravity = Gravity.CENTER_VERTICAL
                    setPadding(dpToPx(12), dpToPx(6), dpToPx(12), dpToPx(6))
                }

                // Edit button — iOS style: soft blue pill with pencil icon + "Edit"
                val editBtn = TextView(this).apply {
                    text = getString(R.string.action_edit); textSize = 11f
                    typeface = android.graphics.Typeface.create("sans-serif-medium", android.graphics.Typeface.NORMAL)
                    setTextColor(ContextCompat.getColor(context, R.color.textLink))
                    setPadding(dpToPx(10), dpToPx(6), dpToPx(10), dpToPx(6))
                    background = ContextCompat.getDrawable(context, R.drawable.bg_chip_link)
                    setCompoundDrawablesRelativeWithIntrinsicBounds(R.drawable.ic_edit, 0, 0, 0)
                    compoundDrawablePadding = dpToPx(3)
                    TextViewCompat.setCompoundDrawableTintList(
                        this,
                        ColorStateList.valueOf(ContextCompat.getColor(context, R.color.textLink))
                    )
                    setOnClickListener {
                        // Single-day edit (web parity): "Edit Day" — change just this one day's type
                        // via the Replace/Extend/Overlap orchestration flow.
                        CreateScheduleActivity.launchForSingleDayEdit(
                            context, schedule.id, schedule.typeId, schedule.typeName,
                            dayMs, schedule.numberOfDays, schedule.startDate, schedule.endDate
                        )
                    }
                }

                // Delete button — iOS style: soft red pill with trash icon + "Delete"
                val deleteBtn = TextView(this).apply {
                    text = getString(R.string.action_delete); textSize = 11f
                    typeface = android.graphics.Typeface.create("sans-serif-medium", android.graphics.Typeface.NORMAL)
                    setTextColor(ContextCompat.getColor(context, R.color.dangerBg))
                    setPadding(dpToPx(10), dpToPx(6), dpToPx(10), dpToPx(6))
                    background = ContextCompat.getDrawable(context, R.drawable.bg_chip_danger)
                    layoutParams = LinearLayout.LayoutParams(
                        ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT
                    ).apply { marginStart = dpToPx(8) }
                    setCompoundDrawablesRelativeWithIntrinsicBounds(R.drawable.ic_trash, 0, 0, 0)
                    compoundDrawablePadding = dpToPx(3)
                    TextViewCompat.setCompoundDrawableTintList(
                        this,
                        ColorStateList.valueOf(ContextCompat.getColor(context, R.color.dangerBg))
                    )
                    setOnClickListener { showDeleteConfirm(schedule.id, schedule.typeName + if (schedule.title.isNotEmpty()) " - ${schedule.title}" else "", "schedule") }
                }

                actionsRow.addView(editBtn)
                actionsRow.addView(deleteBtn)
                card.addView(actionsRow)
            }

            binding.schedulePillsContainer.addView(card)
        }

        // Events — only those whose `date` matches the selected day (not every event of the block).
        val events = matchingSchedules.flatMap { it.events }
            .filter { DateUtils.startOfDayMs(it.date) == dayStart }
        binding.eventsContainer.removeAllViews()
        if (events.isNotEmpty()) {
            binding.tvEventsLabel.visibility = View.VISIBLE
            for (event in events) {
                addEventCard(event, isPast)
            }
        }

        // Notes — same per-day filter as events.
        val notes = matchingSchedules.flatMap { it.notes }
            .filter { DateUtils.startOfDayMs(it.date) == dayStart }
        binding.notesContainer.removeAllViews()
        if (notes.isNotEmpty()) {
            binding.tvNotesLabel.visibility = View.VISIBLE
            for (note in notes) {
                addNoteCard(note, isPast)
            }
        }
    }

    private fun addEventCard(event: ScheduleEvent, isPast: Boolean) {
        val card = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT
            ).apply { bottomMargin = dpToPx(8) }
            background = ContextCompat.getDrawable(context, R.drawable.bg_card_rounded)
        }

        // Event info
        val infoRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            setPadding(dpToPx(10), dpToPx(10), dpToPx(10), dpToPx(10))
        }

        // Color bar
        val colorBar = View(this).apply {
            layoutParams = LinearLayout.LayoutParams(dpToPx(4), ViewGroup.LayoutParams.MATCH_PARENT).apply { marginEnd = dpToPx(10) }
            val bg = GradientDrawable().apply { setColor(event.color.toColorInt()); cornerRadius = dpToPx(2).toFloat() }
            background = bg
        }

        val infoCol = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f)
        }

        if (event.startDateTime > 0) {
            infoCol.addView(TextView(this).apply {
                text = if (event.fullDay) getString(R.string.full_day_label) else DateUtils.formatTime(event.startDateTime)
                textSize = 11f; setTextColor(ContextCompat.getColor(context, R.color.textMuted))
                typeface = android.graphics.Typeface.DEFAULT_BOLD
            })
        }

        infoCol.addView(TextView(this).apply {
            text = event.title; textSize = 14f; setTextColor(ContextCompat.getColor(context, R.color.textPrimary))
            typeface = android.graphics.Typeface.DEFAULT_BOLD
        })

        if (event.location.isNotEmpty()) {
            infoCol.addView(TextView(this).apply {
                text = "📍 ${event.location}"; textSize = 11f
                setTextColor(ContextCompat.getColor(context, R.color.textLink))
                // Web parity (ScheduleDayDetail.jsx:61): click opens Maps
                setOnClickListener {
                    val uri = if (event.locationLat != null && event.locationLng != null) {
                        android.net.Uri.parse("geo:${event.locationLat},${event.locationLng}?q=${android.net.Uri.encode(event.location)}")
                    } else {
                        android.net.Uri.parse("geo:0,0?q=${android.net.Uri.encode(event.location)}")
                    }
                    val mapIntent = Intent(Intent.ACTION_VIEW, uri).apply { setPackage("com.google.android.apps.maps") }
                    if (mapIntent.resolveActivity(packageManager) != null) {
                        startActivity(mapIntent)
                    } else {
                        startActivity(Intent(Intent.ACTION_VIEW, uri))
                    }
                }
            })
        }

        if (event.description.isNotEmpty()) {
            infoCol.addView(TextView(this).apply {
                text = event.description; textSize = 12f; maxLines = 2
                setTextColor(ContextCompat.getColor(context, R.color.textSubtle))
            })
        }

        // Metadata badges (web parity: callType, timezone, reminder, repeat)
        val badgeText = StringBuilder()
        if (event.callType.isNotEmpty()) {
            val callLabel = when (event.callType) {
                "meet_in_person", "in_person" -> "In Person"
                "audio" -> "Audio"
                "video" -> "Video"
                else -> event.callType
            }
            badgeText.append("📞 $callLabel")
        }
        if (event.timezone.isNotEmpty()) {
            if (badgeText.isNotEmpty()) badgeText.append("  ·  ")
            badgeText.append("🌐 ${event.timezone}")
        }
        if (event.reminder.isNotEmpty() && event.reminder != "none") {
            if (badgeText.isNotEmpty()) badgeText.append("  ·  ")
            val reminderLabel = when (event.reminder) {
                "at_time" -> "At time"
                "5min" -> "5 min before"
                "15min" -> "15 min before"
                "30min" -> "30 min before"
                "1hr" -> "1 hr before"
                "1day" -> "1 day before"
                else -> event.reminder
            }
            badgeText.append("🔔 $reminderLabel")
        }
        if (event.repeatStatus.isNotEmpty() && event.repeatStatus != "none") {
            if (badgeText.isNotEmpty()) badgeText.append("  ·  ")
            badgeText.append("🔁 ${event.repeatStatus.replaceFirstChar { it.uppercase() }}")
        }
        if (badgeText.isNotEmpty()) {
            infoCol.addView(TextView(this).apply {
                text = badgeText.toString()
                textSize = 10f
                setTextColor(ContextCompat.getColor(context, R.color.textMuted))
                setPadding(0, dpToPx(4), 0, 0)
            })
        }

        infoRow.addView(colorBar)
        infoRow.addView(infoCol)
        card.addView(infoRow)
        // Tap card to open read-only ViewEventBottomSheet (web parity)
        card.setOnClickListener { ViewEventBottomSheet.newInstance(event).show(supportFragmentManager, "view_event") }

        // Edit + Remove buttons
        if (!isPast) {
            card.addView(View(this).apply {
                layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 1)
                setBackgroundColor(ContextCompat.getColor(context, R.color.borderLight))
            })

            val actionsRow = LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
                setPadding(dpToPx(10), dpToPx(6), dpToPx(10), dpToPx(6))
            }

            // iOS-parity chip backgrounds (soft blue link + soft red danger)
            actionsRow.addView(TextView(this).apply {
                text = getString(R.string.action_edit); textSize = 11f
                typeface = android.graphics.Typeface.create("sans-serif-medium", android.graphics.Typeface.NORMAL)
                setTextColor(ContextCompat.getColor(context, R.color.textLink))
                gravity = android.view.Gravity.CENTER
                setPadding(dpToPx(10), dpToPx(6), dpToPx(10), dpToPx(6))
                background = ContextCompat.getDrawable(context, R.drawable.bg_chip_link)
                setCompoundDrawablesRelativeWithIntrinsicBounds(R.drawable.ic_edit, 0, 0, 0)
                compoundDrawablePadding = dpToPx(3)
                TextViewCompat.setCompoundDrawableTintList(
                    this,
                    ColorStateList.valueOf(ContextCompat.getColor(context, R.color.textLink))
                )
                setOnClickListener {
                    // Pass the full event so CreateEventActivity pre-fills + saves via PUT /events/:id.
                    val json = kotlinx.serialization.json.Json.encodeToString(
                        com.zillit.lcw.data.model.ScheduleEvent.serializer(), event
                    )
                    startActivity(Intent(context, CreateEventActivity::class.java).apply {
                        putExtra("tab", event.eventType)
                        putExtra("editing_event_json", json)
                    })
                }
            })

            actionsRow.addView(TextView(this).apply {
                text = "Remove"; textSize = 11f
                typeface = android.graphics.Typeface.create("sans-serif-medium", android.graphics.Typeface.NORMAL)
                setTextColor(ContextCompat.getColor(context, R.color.dangerBg))
                gravity = android.view.Gravity.CENTER
                setPadding(dpToPx(10), dpToPx(6), dpToPx(10), dpToPx(6))
                background = ContextCompat.getDrawable(context, R.drawable.bg_chip_danger)
                layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { marginStart = dpToPx(8) }
                setCompoundDrawablesRelativeWithIntrinsicBounds(R.drawable.ic_trash, 0, 0, 0)
                compoundDrawablePadding = dpToPx(3)
                TextViewCompat.setCompoundDrawableTintList(
                    this,
                    ColorStateList.valueOf(ContextCompat.getColor(context, R.color.dangerBg))
                )
                setOnClickListener { showDeleteConfirm(event.id, event.title, "event") }
            })

            card.addView(actionsRow)
        }

        binding.eventsContainer.addView(card)
    }

    private fun addNoteCard(note: ScheduleEvent, isPast: Boolean) {
        val card = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT
            ).apply { bottomMargin = dpToPx(8) }
            setPadding(dpToPx(10), dpToPx(10), dpToPx(10), dpToPx(10))
            setBackgroundColor(ContextCompat.getColor(context, R.color.surfaceNoteCard))
            val bg = GradientDrawable().apply {
                setColor(ContextCompat.getColor(context, R.color.surfaceNoteCard))
                cornerRadius = dpToPx(8).toFloat()
            }
            background = bg
        }

        val infoCol = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f)
        }

        infoCol.addView(TextView(this).apply {
            text = note.title; textSize = 14f; typeface = android.graphics.Typeface.DEFAULT_BOLD
            setTextColor(ContextCompat.getColor(context, R.color.textPrimary))
        })

        if (note.notes.isNotEmpty()) {
            infoCol.addView(TextView(this).apply {
                text = note.notes; textSize = 12f; maxLines = 3
                setTextColor(ContextCompat.getColor(context, R.color.textSubtle))
            })
        }

        card.addView(infoCol)

        if (!isPast) {
            val deleteBtn = TextView(this).apply {
                text = "🗑"; textSize = 16f
                setOnClickListener { showDeleteConfirm(note.id, note.title, "event") }
            }
            card.addView(deleteBtn)
        }

        binding.notesContainer.addView(card)
    }

    private fun showDuplicateDialog(schedule: ScheduleDay) {
        val cal = java.util.Calendar.getInstance()
        android.app.DatePickerDialog(this, { _, year, month, day ->
            val newCal = java.util.Calendar.getInstance().apply {
                set(year, month, day, 0, 0, 0); set(java.util.Calendar.MILLISECOND, 0)
            }
            AlertDialog.Builder(this)
                .setTitle("Duplicate Schedule")
                .setMessage("Copy ${schedule.numberOfDays} day(s) of \"${schedule.typeName}${if (schedule.title.isNotEmpty()) " - ${schedule.title}" else ""}\" starting from ${DateUtils.formatDate(newCal.timeInMillis)}?")
                .setPositiveButton("Duplicate") { _, _ ->
                    viewModel.duplicateDay(schedule.id, newCal.timeInMillis)
                }
                .setNegativeButton(getString(R.string.action_cancel), null)
                .show()
        }, cal.get(java.util.Calendar.YEAR), cal.get(java.util.Calendar.MONTH), cal.get(java.util.Calendar.DAY_OF_MONTH)).show()
    }

    private fun showDeleteConfirm(id: String, name: String, type: String) {
        AlertDialog.Builder(this)
            .setTitle(getString(R.string.delete_confirm_title))
            .setMessage("Are you sure you want to delete \"$name\"? This cannot be undone.")
            .setPositiveButton(getString(R.string.action_delete)) { _, _ ->
                if (type == "schedule") {
                    viewModel.deleteDay(id)
                } else {
                    viewModel.deleteEvent(id)
                }
            }
            .setNegativeButton(getString(R.string.action_cancel), null)
            .show()
    }

    override fun onResume() {
        super.onResume()
        viewModel.refreshAll()
    }

    private fun dpToPx(dp: Int): Int = (dp * resources.displayMetrics.density).toInt()
}
