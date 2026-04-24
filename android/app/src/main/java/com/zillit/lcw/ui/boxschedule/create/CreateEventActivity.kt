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
import com.zillit.lcw.databinding.NewBoxActivityCreateEventBinding
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

    private lateinit var binding: NewBoxActivityCreateEventBinding
    private val viewModel: BoxScheduleViewModel by viewModels()

    private var activeTab = "event" // "event" or "note"
    private var startDateMs = System.currentTimeMillis()
    private var endDateMs = System.currentTimeMillis()
    private var linkedScheduleDayId: String? = null
    private var linkedScheduleDate: Long? = null
    private var linkDayOptions: List<LinkDayOption> = emptyList()
    private var selectedEventColor = "#3498DB"
    private var repeatEndDateMs: Long? = null

    // Edit mode — non-null → PUT /events/:id on save; pre-fills every form field.
    private var editingEvent: com.zillit.lcw.data.model.ScheduleEvent? = null
    private val editingEventId: String? get() = editingEvent?.id

    private data class LinkDayOption(
        val scheduleDayId: String,
        val dayMs: Long,
        val label: String
    )
    private var startHour = 9
    private var startMinute = 0
    private var endHour = 10
    private var endMinute = 0
    private var selectedTextColor = "#000000"
    private var selectedNoteColor = "#3498DB"

    // Web-parity color presets (CreateEventModal.jsx COLOR_PRESETS)
    private val webColorPresets = listOf(
        "#3498DB", // Blue
        "#E74C3C", // Red
        "#27AE60", // Green
        "#F39C12", // Orange
        "#8E44AD", // Purple
        "#95A5A6"  // Gray
    )

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = NewBoxActivityCreateEventBinding.inflate(layoutInflater)
        setContentView(binding.root)

        // Edit mode — decode the serialised ScheduleEvent and force the tab to match its type.
        intent.getStringExtra("editing_event_json")?.let { json ->
            try {
                editingEvent = kotlinx.serialization.json.Json.decodeFromString(
                    com.zillit.lcw.data.model.ScheduleEvent.serializer(), json
                )
            } catch (_: Throwable) {}
        }

        // Check intent for initial tab — when present, hide the toggle (iOS mode parity).
        // In edit mode we always force the tab to match the event's type AND hide the switcher.
        val explicitTab = intent.getStringExtra("tab")
        val initialTab = editingEvent?.eventType ?: explicitTab ?: "event"
        binding.tabContainer.visibility =
            if (editingEvent != null || explicitTab != null) View.GONE else View.VISIBLE

        setupHeader()
        setupTabToggle()
        setupEventForm()
        setupNoteForm()
        setupLinkScheduleDayPicker()
        setupFooter()
        observeViewModel()

        // Load schedule days so the Link picker has options
        viewModel.loadAll()

        // Set initial tab
        if (initialTab == "note") {
            binding.eventNoteToggle.check(R.id.btnNoteTab)
        } else {
            binding.eventNoteToggle.check(R.id.btnEventTab)
        }

        // Pre-fill from the existing event (after the form is set up so all views exist).
        editingEvent?.let { applyEditingEventToForm(it) }
        updateTitleAndSaveLabel()
    }

    /** Copy every relevant field from the existing ScheduleEvent into the form bindings. */
    private fun applyEditingEventToForm(e: com.zillit.lcw.data.model.ScheduleEvent) {
        if (e.eventType == "note") {
            binding.etNoteTitle.setText(e.title)
            binding.etNoteText.setText(e.notes)
            selectedNoteColor = e.color.ifEmpty { "#3498DB" }
            setupColorPicker(binding.noteColorPicker, webColorPresets, selectedNoteColor) { selectedNoteColor = it }
            linkedScheduleDayId = e.scheduleDayId
            linkedScheduleDate = e.date.takeIf { it > 0 }
            return
        }

        // Event fields
        binding.etEventTitle.setText(e.title)
        binding.etEventDesc.setText(e.description)

        if (e.startDateTime > 0) {
            startDateMs = e.startDateTime
            binding.tvEventStartDate.text = DateUtils.formatDate(startDateMs)
            val cal = Calendar.getInstance().apply { timeInMillis = e.startDateTime }
            startHour = cal.get(Calendar.HOUR_OF_DAY); startMinute = cal.get(Calendar.MINUTE)
            binding.tvStartTime.text = formatTimeValue(startHour, startMinute)
        }
        if (e.endDateTime > 0) {
            endDateMs = e.endDateTime
            binding.tvEventEndDate.text = DateUtils.formatDate(endDateMs)
            val cal = Calendar.getInstance().apply { timeInMillis = e.endDateTime }
            endHour = cal.get(Calendar.HOUR_OF_DAY); endMinute = cal.get(Calendar.MINUTE)
            binding.tvEndTime.text = formatTimeValue(endHour, endMinute)
        }

        binding.switchFullDay.isChecked = e.fullDay
        binding.etLocation.setText(e.location)
        binding.cbOrganizerExcluded.isChecked = false  // server strips this from read; treat as default

        if (e.repeatEndDate > 0) {
            repeatEndDateMs = e.repeatEndDate
            binding.tvRepeatEndDate.text = DateUtils.formatDate(e.repeatEndDate)
        }

        // Dropdown selections
        binding.spinnerRepeat.setSelection(
            when (e.repeatStatus) { "daily" -> 1; "weekly" -> 2; "monthly" -> 3; else -> 0 }
        )
        binding.spinnerReminder.setSelection(
            when (e.reminder) { "at_time" -> 1; "5min" -> 2; "15min" -> 3; "30min" -> 4; "1hr" -> 5; "1day" -> 6; else -> 0 }
        )
        binding.spinnerCallType.setSelection(
            when (e.callType) { "meet_in_person" -> 1; "audio" -> 2; "video" -> 3; else -> 0 }
        )

        // Event color palette (re-init with the loaded colour so the selected swatch shows correctly)
        selectedEventColor = e.color.ifEmpty { "#3498DB" }
        setupColorPicker(binding.eventColorPicker, webColorPresets, selectedEventColor) { selectedEventColor = it }
        selectedTextColor = e.textColor.ifEmpty { "#000000" }

        // Link to schedule day
        linkedScheduleDayId = e.scheduleDayId
        linkedScheduleDate = e.date.takeIf { it > 0 }
    }

    private fun updateTitleAndSaveLabel() {
        if (editingEvent != null) {
            binding.tvFormTitle.text = if (editingEvent?.eventType == "note") "Edit Note" else "Edit Event"
            binding.btnSave.text = if (editingEvent?.eventType == "note") "Update Note" else "Update Event"
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

        viewModel.scheduleDays.observe(this) { days ->
            refreshLinkDayOptions(days)
        }
    }

    private fun setupLinkScheduleDayPicker() {
        binding.spinnerLinkDay.onItemSelectedListener = object : android.widget.AdapterView.OnItemSelectedListener {
            override fun onItemSelected(parent: android.widget.AdapterView<*>?, view: View?, position: Int, id: Long) {
                if (position <= 0) {
                    linkedScheduleDayId = null
                    linkedScheduleDate = null
                    return
                }
                val opt = linkDayOptions.getOrNull(position - 1) ?: return
                linkedScheduleDayId = opt.scheduleDayId
                linkedScheduleDate = opt.dayMs
                startDateMs = opt.dayMs
                endDateMs = opt.dayMs
                binding.tvEventStartDate.text = DateUtils.formatDate(opt.dayMs)
                binding.tvEventEndDate.text = DateUtils.formatDate(opt.dayMs)
            }
            override fun onNothingSelected(parent: android.widget.AdapterView<*>?) {}
        }
    }

    private fun refreshLinkDayOptions(days: List<com.zillit.lcw.data.model.ScheduleDay>) {
        // Expand each schedule day's calendarDays into individual options (web parity)
        val options = mutableListOf<LinkDayOption>()
        for (sd in days) {
            for (cd in sd.calendarDays.sorted()) {
                val titleSuffix = if (sd.title.isNotEmpty()) " (${sd.title})" else ""
                options.add(
                    LinkDayOption(
                        scheduleDayId = sd.id,
                        dayMs = cd,
                        label = "${DateUtils.formatShortDate(cd)} — ${sd.typeName}$titleSuffix"
                    )
                )
            }
        }
        options.sortBy { it.dayMs }
        linkDayOptions = options

        val labels = mutableListOf(getString(R.string.ce_select_schedule_day))
        labels.addAll(options.map { it.label })
        binding.spinnerLinkDay.adapter = ArrayAdapter(
            this, android.R.layout.simple_spinner_dropdown_item, labels
        )
    }

    private fun setupHeader() {
        binding.btnBack.setOnClickListener { finish() }
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

        // Full day switch — hide the whole time row (iOS parity)
        binding.switchFullDay.setOnCheckedChangeListener { _, isChecked ->
            binding.timeRow.visibility = if (isChecked) View.GONE else View.VISIBLE
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

        // Timezone spinner — device TZ first (iOS parity: TimeZone.current.identifier)
        val deviceTz = TimeZone.getDefault().id
        val commonTimezones = listOf(deviceTz, "UTC", "US/Eastern", "US/Central", "US/Mountain", "US/Pacific", "Europe/London")
        val allTimezones = TimeZone.getAvailableIDs().toList()
        val mergedTimezones = (commonTimezones + allTimezones).distinct()
        binding.spinnerTimezone.adapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, mergedTimezones)
        binding.spinnerTimezone.setSelection(0) // device TZ is at index 0

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

        // Distribute To spinner (web parity: 5 options)
        val distributeOptions = arrayOf(
            getString(R.string.ce_distribute_select),
            getString(R.string.ce_distribute_self),
            getString(R.string.ce_distribute_users),
            getString(R.string.ce_distribute_depts),
            getString(R.string.ce_distribute_all_depts)
        )
        binding.spinnerDistributeTo.adapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, distributeOptions)

        // Event color palette (web parity: 6 presets)
        setupColorPicker(binding.eventColorPicker, webColorPresets, selectedEventColor) { color ->
            selectedEventColor = color
        }

        // Repeat end date picker
        binding.tvRepeatEndDate.setOnClickListener { showDatePicker { ms ->
            repeatEndDateMs = ms
            binding.tvRepeatEndDate.text = DateUtils.formatDate(ms)
        }}

        // Toggle repeat end date visibility based on spinnerRepeat
        binding.spinnerRepeat.onItemSelectedListener = object : android.widget.AdapterView.OnItemSelectedListener {
            override fun onItemSelected(parent: android.widget.AdapterView<*>?, view: View?, position: Int, id: Long) {
                binding.repeatEndDateContainer.visibility = if (position > 0) View.VISIBLE else View.GONE
            }
            override fun onNothingSelected(parent: android.widget.AdapterView<*>?) {}
        }
    }

    private fun setupNoteForm() {
        // Web-parity: 6 preset colors (blue/red/green/orange/purple/gray)
        setupColorPicker(binding.noteColorPicker, webColorPresets, selectedNoteColor) { color ->
            selectedNoteColor = color
        }
    }

    /** Web-parity color swatch: 28dp rounded square, thick dark border when selected. */
    private fun setupColorPicker(
        container: android.widget.LinearLayout,
        colors: List<String>,
        defaultColor: String,
        onColorSelected: (String) -> Unit
    ) {
        container.removeAllViews()
        val size = dpToPx(28)
        val gap = dpToPx(8)
        val cornerPx = dpToPx(6).toFloat()
        val selectedStrokePx = dpToPx(3)
        val unselectedStrokePx = dpToPx(2)
        val borderInput = ContextCompat.getColor(this, R.color.borderLight)
        val solidDark = ContextCompat.getColor(this, R.color.solidDark)

        fun paint(swatch: View, color: String, selected: Boolean) {
            val drawable = GradientDrawable().apply {
                shape = GradientDrawable.RECTANGLE
                cornerRadius = cornerPx
                setColor(color.toColorInt())
                setStroke(
                    if (selected) selectedStrokePx else unselectedStrokePx,
                    if (selected) solidDark else borderInput
                )
            }
            swatch.background = drawable
        }

        for (color in colors) {
            val swatch = View(this).apply {
                layoutParams = android.widget.LinearLayout.LayoutParams(size, size).apply {
                    marginEnd = gap
                }
                paint(this, color, color.equals(defaultColor, ignoreCase = true))
                setOnClickListener {
                    for (i in 0 until container.childCount) {
                        val child = container.getChildAt(i)
                        paint(child, colors[i], colors[i].equals(color, ignoreCase = true))
                    }
                    onColorSelected(color)
                }
            }
            container.addView(swatch)
        }
    }

    private fun dpToPx(dp: Int): Int =
        (dp * resources.displayMetrics.density).toInt()

    private fun setupFooter() {
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
            1 -> "meet_in_person"
            2 -> "audio"
            3 -> "video"
            else -> ""
        }

        val distributeTo = when (binding.spinnerDistributeTo.selectedItemPosition) {
            1 -> "self"
            2 -> "users"
            3 -> "departments"
            4 -> "all_departments"
            else -> ""
        }
        val organizerExcluded = binding.cbOrganizerExcluded.isChecked

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
            repeatEndDateMs?.let { put("repeatEndDate", it) }
            put("callType", callType)
            put("color", selectedEventColor)                 // event color (web parity)
            put("textColor", selectedTextColor)
            put("distributeTo", distributeTo)                 // web parity
            put("organizerExcluded", organizerExcluded)        // web parity
            put("advancedEnabled", true)                       // web parity (always true on mobile)
            put("date", DateUtils.startOfDayMs(linkedScheduleDate ?: startDateMs))
            linkedScheduleDayId?.let { put("scheduleDayId", it) }
        }

        editingEventId?.let { viewModel.updateEvent(it, data) } ?: viewModel.createEvent(data)
        finish()
    }

    private fun saveNote() {
        val noteTitle = binding.etNoteTitle.text.toString().trim()
        if (noteTitle.isEmpty()) {
            Toast.makeText(this, "Title is required", Toast.LENGTH_SHORT).show()
            return
        }

        val noteText = binding.etNoteText.text.toString().trim()

        val data = buildJsonObject {
            put("eventType", "note")
            put("title", noteTitle)
            put("notes", noteText)
            put("color", selectedNoteColor)
            put("date", DateUtils.startOfDayMs(linkedScheduleDate ?: System.currentTimeMillis()))
            linkedScheduleDayId?.let { put("scheduleDayId", it) }
        }

        editingEventId?.let { viewModel.updateEvent(it, data) } ?: viewModel.createEvent(data)
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
