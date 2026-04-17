package com.zillit.lcw.ui.boxschedule.detail

import android.content.Context
import android.content.Intent
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
import com.zillit.lcw.R
import com.zillit.lcw.data.model.ScheduleDay
import com.zillit.lcw.data.model.ScheduleEvent
import com.zillit.lcw.databinding.ActivityDayDetailBinding
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

    private lateinit var binding: ActivityDayDetailBinding
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
        binding = ActivityDayDetailBinding.inflate(layoutInflater)
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
        // Add Note button (add programmatically next to existing buttons)
        val btnAddNote = TextView(this).apply {
            text = getString(R.string.bs_create_note)
            textSize = 12f
            setTextColor(ContextCompat.getColor(context, R.color.textSecondary))
            setPadding(dpToPx(12), dpToPx(8), dpToPx(12), dpToPx(8))
            background = ContextCompat.getDrawable(context, R.drawable.bg_button_secondary)
            setCompoundDrawablesRelativeWithIntrinsicBounds(android.R.drawable.ic_menu_edit, 0, 0, 0)
            compoundDrawablePadding = dpToPx(4)
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            ).apply { marginStart = dpToPx(8) }
            setOnClickListener {
                startActivity(Intent(context, CreateEventActivity::class.java).apply {
                    putExtra("tab", "note")
                })
            }
        }
        binding.actionButtons.addView(btnAddNote)
    }

    private fun observeData() {
        viewModel.scheduleDays.observe(this) { days ->
            populateSchedules(days)
        }
    }

    private fun populateSchedules(allDays: List<ScheduleDay>) {
        val dayStart = DateUtils.startOfDayMs(dayMs)
        val isPast = DateUtils.isPast(dayMs)

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

                // Edit button
                val editBtn = TextView(this).apply {
                    text = getString(R.string.action_edit); textSize = 11f
                    setTextColor(ContextCompat.getColor(context, R.color.textLink))
                    setPadding(dpToPx(8), dpToPx(5), dpToPx(8), dpToPx(5))
                    setCompoundDrawablesRelativeWithIntrinsicBounds(android.R.drawable.ic_menu_edit, 0, 0, 0)
                    compoundDrawablePadding = dpToPx(3)
                    setOnClickListener {
                        // Feature 2: Launch single day edit with schedule data
                        CreateScheduleActivity.launchForSingleDayEdit(
                            context, schedule.id, schedule.typeId, schedule.typeName,
                            dayMs, schedule.numberOfDays, schedule.startDate, schedule.endDate
                        )
                    }
                }

                // Delete button
                val deleteBtn = TextView(this).apply {
                    text = getString(R.string.action_delete); textSize = 11f
                    setTextColor(ContextCompat.getColor(context, R.color.dangerBg))
                    setPadding(dpToPx(8), dpToPx(5), dpToPx(8), dpToPx(5))
                    layoutParams = LinearLayout.LayoutParams(
                        ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT
                    ).apply { marginStart = dpToPx(8) }
                    setCompoundDrawablesRelativeWithIntrinsicBounds(android.R.drawable.ic_menu_delete, 0, 0, 0)
                    compoundDrawablePadding = dpToPx(3)
                    setOnClickListener { showDeleteConfirm(schedule.id, schedule.typeName + if (schedule.title.isNotEmpty()) " - ${schedule.title}" else "", "schedule") }
                }

                actionsRow.addView(editBtn)
                actionsRow.addView(deleteBtn)
                card.addView(actionsRow)
            }

            binding.schedulePillsContainer.addView(card)
        }

        // Events
        val events = matchingSchedules.flatMap { it.events }
        binding.eventsContainer.removeAllViews()
        if (events.isNotEmpty()) {
            binding.tvEventsLabel.visibility = View.VISIBLE
            for (event in events) {
                addEventCard(event, isPast)
            }
        }

        // Notes
        val notes = matchingSchedules.flatMap { it.notes }
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
            })
        }

        if (event.description.isNotEmpty()) {
            infoCol.addView(TextView(this).apply {
                text = event.description; textSize = 12f; maxLines = 2
                setTextColor(ContextCompat.getColor(context, R.color.textSubtle))
            })
        }

        infoRow.addView(colorBar)
        infoRow.addView(infoCol)
        card.addView(infoRow)

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

            actionsRow.addView(TextView(this).apply {
                text = getString(R.string.action_edit); textSize = 11f
                setTextColor(ContextCompat.getColor(context, R.color.textLink))
                setPadding(dpToPx(8), dpToPx(5), dpToPx(8), dpToPx(5))
                setOnClickListener { startActivity(Intent(context, CreateEventActivity::class.java).apply { putExtra("tab", "event") }) }
            })

            actionsRow.addView(TextView(this).apply {
                text = "Remove"; textSize = 11f
                setTextColor(ContextCompat.getColor(context, R.color.dangerBg))
                setPadding(dpToPx(8), dpToPx(5), dpToPx(8), dpToPx(5))
                layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { marginStart = dpToPx(8) }
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
