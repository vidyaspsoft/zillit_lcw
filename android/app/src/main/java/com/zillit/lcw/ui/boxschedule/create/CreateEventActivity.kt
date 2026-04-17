package com.zillit.lcw.ui.boxschedule.create

import android.app.DatePickerDialog
import android.app.TimePickerDialog
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.view.View
import android.widget.ArrayAdapter
import android.widget.Toast
import androidx.activity.viewModels
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import com.zillit.lcw.R
import com.zillit.lcw.databinding.ActivityCreateEventBinding
import com.zillit.lcw.ui.boxschedule.BoxScheduleViewModel
import com.zillit.lcw.util.DateUtils
import com.zillit.lcw.util.showToast
import com.zillit.lcw.util.toColorInt
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.util.*

/**
 * CreateEventActivity — Full-screen form for creating events or notes.
 * Matches web's CreateEventModal.
 * Event/Note tab switch, all form fields. Wired to API via ViewModel.
 */
class CreateEventActivity : AppCompatActivity() {

    private lateinit var binding: ActivityCreateEventBinding
    private val viewModel: BoxScheduleViewModel by viewModels()

    private var activeTab = "event" // "event" or "note"
    private var startDateMs = System.currentTimeMillis()
    private var endDateMs = System.currentTimeMillis()
    private var startHour = 9
    private var startMinute = 0
    private var endHour = 10
    private var endMinute = 0
    private var selectedTextColor = "#1A1A1A"
    private var selectedNoteColor = "#FFFDF0"

    // Color options for text/note background
    private val colorOptions = listOf(
        "#1A1A1A", "#E74C3C", "#3498DB", "#27AE60",
        "#F39C12", "#8E44AD", "#1ABC9C", "#E67E22"
    )

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityCreateEventBinding.inflate(layoutInflater)
        setContentView(binding.root)

        // Check intent for initial tab
        val initialTab = intent.getStringExtra("tab") ?: "event"

        setupHeader()
        setupTabToggle()
        setupEventForm()
        setupNoteForm()
        setupFooter()
        observeViewModel()

        // Set initial tab
        if (initialTab == "note") {
            binding.eventNoteToggle.check(R.id.btnNoteTab)
        } else {
            binding.eventNoteToggle.check(R.id.btnEventTab)
        }
    }

    private fun observeViewModel() {
        viewModel.errorMessage.observe(this) { message ->
            if (!message.isNullOrEmpty()) {
                Toast.makeText(this, message, Toast.LENGTH_SHORT).show()
            }
        }

        viewModel.isLoading.observe(this) { loading ->
            binding.btnSave.isEnabled = !loading
        }
    }

    private fun setupHeader() {
        binding.btnClose.setOnClickListener { finish() }
    }

    private fun setupTabToggle() {
        binding.eventNoteToggle.addOnButtonCheckedListener { _, checkedId, isChecked ->
            if (!isChecked) return@addOnButtonCheckedListener
            when (checkedId) {
                R.id.btnEventTab -> {
                    activeTab = "event"
                    binding.eventForm.visibility = View.VISIBLE
                    binding.noteForm.visibility = View.GONE
                    binding.tvFormTitle.text = getString(R.string.ce_add_event)
                    binding.btnSave.text = getString(R.string.ce_save_event)
                }
                R.id.btnNoteTab -> {
                    activeTab = "note"
                    binding.eventForm.visibility = View.GONE
                    binding.noteForm.visibility = View.VISIBLE
                    binding.tvFormTitle.text = getString(R.string.ce_add_note)
                    binding.btnSave.text = getString(R.string.ce_save_note)
                }
            }
        }
    }

    private fun setupEventForm() {
        // Date pickers
        binding.tvEventStartDate.text = DateUtils.formatDate(startDateMs)
        binding.tvEventStartDate.setOnClickListener { showDatePicker { ms ->
            startDateMs = ms
            binding.tvEventStartDate.text = DateUtils.formatDate(ms)
        }}

        binding.tvEventEndDate.text = DateUtils.formatDate(endDateMs)
        binding.tvEventEndDate.setOnClickListener { showDatePicker { ms ->
            endDateMs = ms
            binding.tvEventEndDate.text = DateUtils.formatDate(ms)
        }}

        // Time pickers
        binding.tvStartTime.text = formatTimeValue(startHour, startMinute)
        binding.tvStartTime.setOnClickListener { showTimePicker(startHour, startMinute) { hour, minute ->
            startHour = hour
            startMinute = minute
            binding.tvStartTime.text = formatTimeValue(hour, minute)
        }}

        binding.tvEndTime.text = formatTimeValue(endHour, endMinute)
        binding.tvEndTime.setOnClickListener { showTimePicker(endHour, endMinute) { hour, minute ->
            endHour = hour
            endMinute = minute
            binding.tvEndTime.text = formatTimeValue(hour, minute)
        }}

        // Full day switch
        binding.switchFullDay.setOnCheckedChangeListener { _, isChecked ->
            val timeVisibility = if (isChecked) View.GONE else View.VISIBLE
            binding.tvStartTime.visibility = timeVisibility
            binding.tvEndTime.visibility = timeVisibility
        }

        // Repeat spinner
        val repeatOptions = arrayOf(
            getString(R.string.ce_no_repeat),
            getString(R.string.ce_daily),
            getString(R.string.ce_weekly),
            getString(R.string.ce_monthly)
        )
        binding.spinnerRepeat.adapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, repeatOptions)

        // Repeat end date
        binding.tvRepeatEndDate.setOnClickListener { showDatePicker { ms ->
            binding.tvRepeatEndDate.text = DateUtils.formatDate(ms)
        }}

        // Timezone spinner — populate with common + all available IDs
        val commonTimezones = listOf("UTC", "US/Eastern", "US/Central", "US/Mountain", "US/Pacific", "Europe/London")
        val allTimezones = TimeZone.getAvailableIDs().toList()
        val mergedTimezones = (commonTimezones + allTimezones).distinct()
        binding.spinnerTimezone.adapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, mergedTimezones)

        // Reminder spinner
        val reminders = arrayOf(
            getString(R.string.ce_no_reminder),
            getString(R.string.ce_at_time),
            getString(R.string.ce_5min),
            getString(R.string.ce_15min),
            getString(R.string.ce_30min),
            getString(R.string.ce_1hr),
            getString(R.string.ce_1day)
        )
        binding.spinnerReminder.adapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, reminders)

        // Call type spinner
        val callTypes = arrayOf(
            getString(R.string.ce_select_call_type),
            getString(R.string.ce_meet_in_person),
            getString(R.string.ce_audio),
            getString(R.string.ce_video)
        )
        binding.spinnerCallType.adapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, callTypes)

        // Text color picker
        setupColorPicker(binding.textColorPicker, colorOptions) { color ->
            selectedTextColor = color
        }
    }

    private fun setupNoteForm() {
        // Note background color picker
        val noteColors = listOf(
            "#FFFDF0", "#FEF2F2", "#F0F5FF", "#F0FDF4",
            "#FEF9EE", "#F5F0FF", "#F0FDFA", "#FFF7ED"
        )
        setupColorPicker(binding.noteColorPicker, noteColors) { color ->
            selectedNoteColor = color
        }
    }

    private fun setupColorPicker(
        container: android.widget.LinearLayout,
        colors: List<String>,
        onColorSelected: (String) -> Unit
    ) {
        container.removeAllViews()
        val size = resources.getDimensionPixelSize(R.dimen.cal_today_circle)
        val margin = resources.getDimensionPixelSize(R.dimen.spacing_sm)

        for ((index, color) in colors.withIndex()) {
            val swatch = View(this).apply {
                layoutParams = android.widget.LinearLayout.LayoutParams(size, size).apply {
                    marginEnd = margin
                }
                val drawable = GradientDrawable().apply {
                    shape = GradientDrawable.OVAL
                    setColor(color.toColorInt())
                    setStroke(
                        2,
                        if (index == 0) ContextCompat.getColor(context, R.color.textPrimary)
                        else ContextCompat.getColor(context, R.color.borderLight)
                    )
                }
                background = drawable
                setOnClickListener {
                    // Reset all borders, highlight selected
                    for (i in 0 until container.childCount) {
                        val child = container.getChildAt(i)
                        val bg = child.background as? GradientDrawable ?: return@setOnClickListener
                        bg.setStroke(2, ContextCompat.getColor(context, R.color.borderLight))
                    }
                    val selectedBg = background as GradientDrawable
                    selectedBg.setStroke(2, ContextCompat.getColor(context, R.color.textPrimary))
                    onColorSelected(color)
                }
            }
            container.addView(swatch)
        }
    }

    private fun setupFooter() {
        binding.btnCancel.setOnClickListener { finish() }
        binding.btnSave.setOnClickListener {
            if (activeTab == "event") {
                saveEvent()
            } else {
                saveNote()
            }
        }
    }

    private fun saveEvent() {
        val title = binding.etEventTitle.text.toString().trim()
        if (title.isEmpty()) {
            Toast.makeText(this, getString(R.string.ce_title_hint), Toast.LENGTH_SHORT).show()
            return
        }

        val isFullDay = binding.switchFullDay.isChecked

        // Validate end date >= start date
        if (endDateMs < startDateMs) {
            Toast.makeText(this, getString(R.string.cs_end_date) + " must be on or after " + getString(R.string.cs_start_date), Toast.LENGTH_SHORT).show()
            return
        }

        // Validate end time > start time if not full day and same date
        if (!isFullDay && endDateMs == startDateMs) {
            val startTotal = startHour * 60 + startMinute
            val endTotal = endHour * 60 + endMinute
            if (endTotal <= startTotal) {
                Toast.makeText(this, getString(R.string.ce_end_time) + " must be after " + getString(R.string.ce_start_time), Toast.LENGTH_SHORT).show()
                return
            }
        }

        // Build start/end DateTimes
        val startCal = Calendar.getInstance().apply {
            timeInMillis = startDateMs
            set(Calendar.HOUR_OF_DAY, startHour)
            set(Calendar.MINUTE, startMinute)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }
        val endCal = Calendar.getInstance().apply {
            timeInMillis = endDateMs
            set(Calendar.HOUR_OF_DAY, endHour)
            set(Calendar.MINUTE, endMinute)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }

        val description = binding.etEventDesc.text.toString().trim()
        val location = binding.etLocation?.text?.toString()?.trim() ?: ""
        val timezone = binding.spinnerTimezone.selectedItem?.toString() ?: "UTC"
        val reminder = when (binding.spinnerReminder.selectedItemPosition) {
            1 -> "at_time"
            2 -> "5min"
            3 -> "15min"
            4 -> "30min"
            5 -> "1hr"
            6 -> "1day"
            else -> "none"
        }
        val repeatStatus = when (binding.spinnerRepeat.selectedItemPosition) {
            1 -> "daily"
            2 -> "weekly"
            3 -> "monthly"
            else -> "none"
        }
        val callType = when (binding.spinnerCallType.selectedItemPosition) {
            1 -> "in_person"
            2 -> "audio"
            3 -> "video"
            else -> ""
        }

        val data = buildJsonObject {
            put("eventType", "event")
            put("title", title)
            put("description", description)
            put("startDateTime", startCal.timeInMillis)
            put("endDateTime", endCal.timeInMillis)
            put("fullDay", isFullDay)
            put("location", location)
            put("timezone", timezone)
            put("reminder", reminder)
            put("repeatStatus", repeatStatus)
            put("callType", callType)
            put("textColor", selectedTextColor)
            put("date", DateUtils.startOfDayMs(startDateMs))
        }

        viewModel.createEvent(data)
        finish()
    }

    private fun saveNote() {
        val noteTitle = binding.etNoteTitle.text.toString().trim()
        if (noteTitle.isEmpty()) {
            Toast.makeText(this, getString(R.string.ce_note_title_hint), Toast.LENGTH_SHORT).show()
            return
        }

        val noteText = binding.etNoteText.text.toString().trim()

        val data = buildJsonObject {
            put("eventType", "note")
            put("title", noteTitle)
            put("notes", noteText)
            put("color", selectedNoteColor)
            put("date", DateUtils.startOfDayMs(System.currentTimeMillis()))
        }

        viewModel.createEvent(data)
        finish()
    }

    private fun formatTimeValue(hour: Int, minute: Int): String {
        val cal = Calendar.getInstance().apply {
            set(Calendar.HOUR_OF_DAY, hour)
            set(Calendar.MINUTE, minute)
        }
        return DateUtils.formatTime(cal.timeInMillis)
    }

    private fun showDatePicker(onDateSelected: (Long) -> Unit) {
        val cal = Calendar.getInstance()
        DatePickerDialog(this, { _, year, month, day ->
            val selected = Calendar.getInstance().apply {
                set(year, month, day, 0, 0, 0)
                set(Calendar.MILLISECOND, 0)
            }
            onDateSelected(selected.timeInMillis)
        }, cal.get(Calendar.YEAR), cal.get(Calendar.MONTH), cal.get(Calendar.DAY_OF_MONTH)).show()
    }

    private fun showTimePicker(defaultHour: Int, defaultMinute: Int, onTimeSelected: (Int, Int) -> Unit) {
        TimePickerDialog(this, { _, hour, minute ->
            onTimeSelected(hour, minute)
        }, defaultHour, defaultMinute, false).show()
    }
}
