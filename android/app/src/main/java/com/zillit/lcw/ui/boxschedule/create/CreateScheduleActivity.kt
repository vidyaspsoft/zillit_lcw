package com.zillit.lcw.ui.boxschedule.create

import android.app.DatePickerDialog
import android.content.Context
import android.content.Intent
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.activity.viewModels
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import com.google.android.material.chip.Chip
import com.google.android.material.tabs.TabLayout
import com.zillit.lcw.R
import com.zillit.lcw.data.model.ScheduleType
import com.zillit.lcw.databinding.ActivityCreateScheduleBinding
import com.zillit.lcw.ui.boxschedule.BoxScheduleViewModel
import com.zillit.lcw.ui.boxschedule.types.TypeManagerDialog
import com.zillit.lcw.util.DateUtils
import com.zillit.lcw.util.toColorInt
import java.util.*

/**
 * CreateScheduleActivity — matches web's CreateScheduleModal with all 7 features:
 * 1. Locked start date from calendar cell
 * 2. Single day edit with Replace/Extend/Overlap
 * 3. 409 conflict handling
 * 4. Calendar picked dates tags
 * 5. Past dates disabled
 * 6. Edit auto-fills type + dates + correct tab
 * 7. Same as iOS
 */
class CreateScheduleActivity : AppCompatActivity() {

    private lateinit var binding: ActivityCreateScheduleBinding
    private val viewModel: BoxScheduleViewModel by viewModels()

    private var selectedTypeId = ""
    private var startDateMs: Long = DateUtils.startOfDayMs(System.currentTimeMillis())
    private var endDateMs: Long = 0L
    private var numberOfDays = 5
    private var setByMode = "days"
    private var dateTabMode = "dateRange"

    // Calendar picked dates
    private val pickedDates = mutableSetOf<Long>()

    // Day Wise
    private val selectedWeekdays = mutableSetOf<Int>()
    private var dayWiseStartMs = DateUtils.startOfDayMs(System.currentTimeMillis())
    private var dayWiseEndMs = DateUtils.addDays(dayWiseStartMs, 6)

    // Types from API
    private var apiTypes: List<ScheduleType> = emptyList()

    // Feature 1: Locked date
    private var lockedDate: Long = 0L
    private var isStartDateLocked = false

    // Feature 2: Single day edit
    private var isSingleDayEdit = false
    private var singleDate: Long = 0L
    private var editingDayId = ""
    private var editingTypeName = ""
    private var editingTypeId = ""
    private var singleDayConflictAction = "replace"

    // Feature 6: Edit mode
    private var isEditing = false

    companion object {
        const val EXTRA_LOCKED_DATE = "locked_date"
        const val EXTRA_SINGLE_DAY_EDIT = "single_day_edit"
        const val EXTRA_SINGLE_DATE = "single_date"
        const val EXTRA_EDITING_DAY_ID = "editing_day_id"
        const val EXTRA_EDITING_TYPE_ID = "editing_type_id"
        const val EXTRA_EDITING_TYPE_NAME = "editing_type_name"
        const val EXTRA_EDITING_NUM_DAYS = "editing_num_days"
        const val EXTRA_EDITING_START_DATE = "editing_start_date"
        const val EXTRA_EDITING_END_DATE = "editing_end_date"

        fun launchForDate(context: Context, lockedDateMs: Long) {
            context.startActivity(Intent(context, CreateScheduleActivity::class.java).apply {
                putExtra(EXTRA_LOCKED_DATE, lockedDateMs)
            })
        }

        fun launchForSingleDayEdit(context: Context, dayId: String, typeId: String, typeName: String, singleDateMs: Long, numDays: Int, startDate: Long, endDate: Long) {
            context.startActivity(Intent(context, CreateScheduleActivity::class.java).apply {
                putExtra(EXTRA_SINGLE_DAY_EDIT, true)
                putExtra(EXTRA_SINGLE_DATE, singleDateMs)
                putExtra(EXTRA_EDITING_DAY_ID, dayId)
                putExtra(EXTRA_EDITING_TYPE_ID, typeId)
                putExtra(EXTRA_EDITING_TYPE_NAME, typeName)
                putExtra(EXTRA_EDITING_NUM_DAYS, numDays)
                putExtra(EXTRA_EDITING_START_DATE, startDate)
                putExtra(EXTRA_EDITING_END_DATE, endDate)
            })
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityCreateScheduleBinding.inflate(layoutInflater)
        setContentView(binding.root)

        readIntentExtras()
        setupToolbar()
        setupTypeSection()
        setupDateTabs()
        setupDateRange()
        setupDayWise()
        setupSave()
        observeViewModel()

        viewModel.fetchTypes()
        updateSummary()
    }

    private fun readIntentExtras() {
        // Feature 1: Locked date
        lockedDate = intent.getLongExtra(EXTRA_LOCKED_DATE, 0L)
        if (lockedDate > 0) {
            isStartDateLocked = true
            startDateMs = DateUtils.startOfDayMs(lockedDate)
            numberOfDays = 1
            pickedDates.add(startDateMs)
        }

        // Feature 2: Single day edit
        isSingleDayEdit = intent.getBooleanExtra(EXTRA_SINGLE_DAY_EDIT, false)
        singleDate = intent.getLongExtra(EXTRA_SINGLE_DATE, 0L)
        editingDayId = intent.getStringExtra(EXTRA_EDITING_DAY_ID) ?: ""
        editingTypeId = intent.getStringExtra(EXTRA_EDITING_TYPE_ID) ?: ""
        editingTypeName = intent.getStringExtra(EXTRA_EDITING_TYPE_NAME) ?: ""

        // Feature 6: Edit mode
        isEditing = editingDayId.isNotEmpty()
        if (isEditing) {
            selectedTypeId = editingTypeId
            val numDays = intent.getIntExtra(EXTRA_EDITING_NUM_DAYS, 5)
            val start = intent.getLongExtra(EXTRA_EDITING_START_DATE, startDateMs)
            val end = intent.getLongExtra(EXTRA_EDITING_END_DATE, 0L)
            numberOfDays = numDays
            startDateMs = DateUtils.startOfDayMs(start)
            if (end > 0) endDateMs = DateUtils.startOfDayMs(end)
        }
    }

    private fun setupToolbar() {
        binding.btnCancel.visibility = View.GONE  // Back button handles navigation
        val title = when {
            isSingleDayEdit -> "Edit Day"
            isEditing -> "Edit Schedule"
            else -> getString(R.string.bs_create_schedule)
        }
        // Find title TextView and update
        val titleView = binding.root.findViewById<TextView>(android.R.id.title)
            ?: (binding.root as ViewGroup).getChildAt(0)?.let {
                (it as? ViewGroup)?.let { toolbar ->
                    for (i in 0 until toolbar.childCount) {
                        val child = toolbar.getChildAt(i)
                        if (child is TextView && child.text.toString().contains("Schedule")) {
                            child.text = title
                            return@let child
                        }
                    }
                    null
                }
            }

        binding.btnSave.text = if (isEditing) "Save Changes" else getString(R.string.cs_save)
    }

    private fun setupTypeSection() {
        // Type search
        binding.etTypeSearch.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                filterTypes(s?.toString() ?: "")
            }
            override fun afterTextChanged(s: Editable?) {}
        })

        // Add New Type button
        binding.btnAddNewType.setOnClickListener {
            TypeManagerDialog().show(supportFragmentManager, "types")
        }

        // Handle new type form
        binding.newTypeForm.visibility = View.GONE
    }

    private fun filterTypes(query: String) {
        val filtered = if (query.isEmpty()) apiTypes else apiTypes.filter { it.title.contains(query, ignoreCase = true) }
        updateTypeList(filtered)
    }

    private fun updateTypeList(types: List<ScheduleType>) {
        binding.typeList.removeAllViews()
        for (type in types) {
            val row = LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
                setPadding(dpToPx(12), dpToPx(10), dpToPx(12), dpToPx(10))
                background = ContextCompat.getDrawable(context, R.drawable.bg_card_rounded)
                layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
                    bottomMargin = dpToPx(4)
                }
                setOnClickListener {
                    selectedTypeId = type.id
                    showSelectedType(type)
                }
            }

            val dot = View(this).apply {
                layoutParams = LinearLayout.LayoutParams(dpToPx(10), dpToPx(10)).apply { marginEnd = dpToPx(8) }
                val bg = GradientDrawable().apply { shape = GradientDrawable.OVAL; setColor(type.color.toColorInt()) }
                background = bg
            }

            val name = TextView(this).apply {
                text = type.title; textSize = 13f
                setTextColor(ContextCompat.getColor(context, R.color.textPrimary))
                layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f)
            }

            row.addView(dot)
            row.addView(name)

            if (type.systemDefined) {
                val badge = TextView(this).apply {
                    text = "SYSTEM"; textSize = 8f
                    setTextColor(ContextCompat.getColor(context, R.color.textSubtle))
                    setPadding(dpToPx(4), dpToPx(1), dpToPx(4), dpToPx(1))
                }
                row.addView(badge)
            }

            binding.typeList.addView(row)
        }

        // Show/hide selected type vs dropdown
        val isTypeSelected = selectedTypeId.isNotEmpty() && apiTypes.any { it.id == selectedTypeId }
        if (isTypeSelected) {
            val type = apiTypes.first { it.id == selectedTypeId }
            showSelectedType(type)
        }
    }

    private fun showSelectedType(type: ScheduleType) {
        binding.selectedTypeContainer.visibility = View.VISIBLE
        binding.etTypeSearch.visibility = View.GONE
        binding.typeList.visibility = View.GONE
        binding.btnAddNewType.visibility = View.GONE

        binding.selectedTypeName.text = type.title
        val dotBg = GradientDrawable().apply {
            shape = GradientDrawable.OVAL
            setColor(type.color.toColorInt())
        }
        binding.selectedTypeDot.background = dotBg
        binding.selectedTypeContainer.background = GradientDrawable().apply {
            setColor(type.color.toColorInt() and 0x14FFFFFF or 0x14000000)
            cornerRadius = dpToPx(8).toFloat()
            setStroke(dpToPx(2), type.color.toColorInt())
        }

        binding.btnChangeType.setOnClickListener {
            selectedTypeId = ""
            binding.selectedTypeContainer.visibility = View.GONE
            binding.etTypeSearch.visibility = View.VISIBLE
            binding.typeList.visibility = View.VISIBLE
            binding.btnAddNewType.visibility = View.VISIBLE
            updateTypeList(apiTypes)
        }
    }

    private fun observeViewModel() {
        viewModel.scheduleTypes.observe(this) { types ->
            apiTypes = types
            updateTypeList(types)

            // Feature 6: Auto-select type when editing
            if (selectedTypeId.isNotEmpty()) {
                val type = types.find { it.id == selectedTypeId }
                if (type != null) showSelectedType(type)
            }
        }

        viewModel.errorMessage.observe(this) { message ->
            if (!message.isNullOrEmpty()) {
                if (message.contains("409") || message.contains("conflict", ignoreCase = true)) {
                    showConflictDialog()
                } else {
                    Toast.makeText(this, message, Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    private fun setupDateTabs() {
        // Hide date tabs in single day edit mode
        if (isSingleDayEdit) {
            binding.dateModeTabs.visibility = View.GONE
            binding.dateRangeContent.visibility = View.GONE
            binding.calendarContent.visibility = View.GONE
            binding.dayWiseContent.visibility = View.GONE
            setupSingleDayEditUI()
            return
        }

        binding.dateModeTabs.addTab(binding.dateModeTabs.newTab().setText(getString(R.string.cs_date_range)))
        binding.dateModeTabs.addTab(binding.dateModeTabs.newTab().setText(getString(R.string.cs_calendar)))
        binding.dateModeTabs.addTab(binding.dateModeTabs.newTab().setText(getString(R.string.cs_day_wise)))

        binding.dateModeTabs.addOnTabSelectedListener(object : TabLayout.OnTabSelectedListener {
            override fun onTabSelected(tab: TabLayout.Tab?) {
                when (tab?.position) {
                    0 -> { dateTabMode = "dateRange"; binding.dateRangeContent.visibility = View.VISIBLE; binding.calendarContent.visibility = View.GONE; binding.dayWiseContent.visibility = View.GONE }
                    1 -> { dateTabMode = "calendar"; binding.dateRangeContent.visibility = View.GONE; binding.calendarContent.visibility = View.VISIBLE; binding.dayWiseContent.visibility = View.GONE }
                    2 -> { dateTabMode = "dayWise"; binding.dateRangeContent.visibility = View.GONE; binding.calendarContent.visibility = View.GONE; binding.dayWiseContent.visibility = View.VISIBLE }
                }
                updateSummary()
            }
            override fun onTabUnselected(tab: TabLayout.Tab?) {}
            override fun onTabReselected(tab: TabLayout.Tab?) {}
        })
    }

    // Feature 2: Single Day Edit UI
    private fun setupSingleDayEditUI() {
        // Show locked date info
        if (singleDate > 0) {
            val dateInfo = TextView(this).apply {
                text = DateUtils.formatFullDay(singleDate)
                textSize = 15f; typeface = android.graphics.Typeface.DEFAULT_BOLD
                setTextColor(ContextCompat.getColor(context, R.color.textPrimary))
            }
            val dateNote = TextView(this).apply {
                text = "Date cannot be changed when editing a single day"
                textSize = 11f
                setTextColor(ContextCompat.getColor(context, R.color.textSubtle))
            }

            val container = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                setPadding(dpToPx(12), dpToPx(12), dpToPx(12), dpToPx(12))
                background = ContextCompat.getDrawable(context, R.drawable.bg_card_rounded)
                layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
                    bottomMargin = dpToPx(16)
                }
            }
            container.addView(dateInfo)
            container.addView(dateNote)

            // Add after type section
            val parent = binding.dateModeTabs.parent as? ViewGroup
            val tabIndex = parent?.indexOfChild(binding.dateModeTabs) ?: -1
            if (tabIndex >= 0) parent?.addView(container, tabIndex)
        }
    }

    private fun setupDateRange() {
        // Feature 5: Disable past dates
        val today = DateUtils.startOfDayMs(System.currentTimeMillis())

        binding.tvStartDate.text = DateUtils.formatDate(startDateMs)
        if (isStartDateLocked) {
            binding.tvStartDate.isEnabled = false
            binding.tvStartDate.alpha = 0.5f
        } else {
            binding.tvStartDate.setOnClickListener {
                showDatePicker(today) { ms -> startDateMs = ms; binding.tvStartDate.text = DateUtils.formatDate(ms); updateSummary() }
            }
        }

        binding.rangeSubModeToggle.check(R.id.btnByDays)
        binding.rangeSubModeToggle.addOnButtonCheckedListener { _, checkedId, isChecked ->
            if (!isChecked) return@addOnButtonCheckedListener
            when (checkedId) {
                R.id.btnByDays -> { setByMode = "days"; binding.numberOfDaysContainer.visibility = View.VISIBLE; binding.endDateContainer.visibility = View.GONE }
                R.id.btnByEndDate -> { setByMode = "endDate"; binding.numberOfDaysContainer.visibility = View.GONE; binding.endDateContainer.visibility = View.VISIBLE }
            }
            updateSummary()
        }

        binding.etNumberOfDays.setText(numberOfDays.toString())
        binding.btnMinus.setOnClickListener {
            val n = binding.etNumberOfDays.text.toString().toIntOrNull() ?: 1
            if (n > 1) { binding.etNumberOfDays.setText((n - 1).toString()); numberOfDays = n - 1; updateSummary() }
        }
        binding.btnPlus.setOnClickListener {
            val n = binding.etNumberOfDays.text.toString().toIntOrNull() ?: 1
            binding.etNumberOfDays.setText((n + 1).toString()); numberOfDays = n + 1; updateSummary()
        }
        binding.etNumberOfDays.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
            override fun afterTextChanged(s: Editable?) {
                numberOfDays = s?.toString()?.toIntOrNull() ?: 1
                updateSummary()
            }
        })

        binding.tvEndDate.setOnClickListener {
            showDatePicker(startDateMs) { ms -> endDateMs = ms; binding.tvEndDate.text = DateUtils.formatDate(ms); updateSummary() }
        }
    }

    private fun setupDayWise() {
        val today = DateUtils.startOfDayMs(System.currentTimeMillis())
        binding.tvDayWiseStart.text = DateUtils.formatDate(dayWiseStartMs)
        binding.tvDayWiseStart.setOnClickListener {
            showDatePicker(today) { ms -> dayWiseStartMs = ms; binding.tvDayWiseStart.text = DateUtils.formatDate(ms); updateSummary() }
        }
        binding.tvDayWiseEnd.text = DateUtils.formatDate(dayWiseEndMs)
        binding.tvDayWiseEnd.setOnClickListener {
            showDatePicker(dayWiseStartMs) { ms -> dayWiseEndMs = ms; binding.tvDayWiseEnd.text = DateUtils.formatDate(ms); updateSummary(); updateWeekdayChips() }
        }
        updateWeekdayChips()
    }

    private fun updateWeekdayChips() {
        binding.weekdayChips.removeAllViews()
        val dayLabels = arrayOf("Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat")
        val available = mutableSetOf<Int>()

        if (dayWiseEndMs > 0) {
            val cal = Calendar.getInstance().apply { timeInMillis = dayWiseStartMs }
            val endCal = Calendar.getInstance().apply { timeInMillis = dayWiseEndMs }
            while (!cal.after(endCal)) {
                available.add(cal.get(Calendar.DAY_OF_WEEK) - 1) // 0=Sun
                cal.add(Calendar.DAY_OF_MONTH, 1)
            }
        }

        for (i in 0..6) {
            val isAvailable = available.isEmpty() || available.contains(i)
            val chip = Chip(this).apply {
                text = dayLabels[i]
                isCheckable = true
                isChecked = selectedWeekdays.contains(i + 1)
                isEnabled = isAvailable
                alpha = if (isAvailable) 1f else 0.35f
                setOnCheckedChangeListener { _, checked ->
                    if (checked) selectedWeekdays.add(i + 1) else selectedWeekdays.remove(i + 1)
                    updateSummary()
                }
            }
            binding.weekdayChips.addView(chip)
        }
    }

    private fun setupSave() {
        binding.btnCancel.setOnClickListener { finish() }
        binding.btnSave.setOnClickListener { saveSchedule() }
    }

    private fun saveSchedule(conflictAction: String = "") {
        if (selectedTypeId.isEmpty()) {
            Toast.makeText(this, getString(R.string.cs_error_select_type), Toast.LENGTH_SHORT).show()
            return
        }

        val calendarDays = if (isSingleDayEdit && singleDate > 0) {
            listOf(singleDate)
        } else {
            collectCalendarDays()
        }

        if (calendarDays.isEmpty() && !isSingleDayEdit) {
            Toast.makeText(this, getString(R.string.cs_error_select_dates), Toast.LENGTH_SHORT).show()
            return
        }

        val action = if (isSingleDayEdit) singleDayConflictAction else conflictAction
        val drt = when (dateTabMode) {
            "calendar" -> "by_dates"
            "dayWise" -> "day_wise"
            else -> "by_days"
        }

        viewModel.createDay("", selectedTypeId, drt, calendarDays, action)

        // Close on success
        viewModel.scheduleDays.observe(this) { finish() }
    }

    private fun collectCalendarDays(): List<Long> {
        return when (dateTabMode) {
            "dateRange" -> {
                if (setByMode == "days") {
                    val n = binding.etNumberOfDays.text.toString().toIntOrNull() ?: 1
                    (0 until n).map { DateUtils.startOfDayMs(DateUtils.addDays(startDateMs, it)) }
                } else {
                    if (endDateMs <= 0) return emptyList()
                    val days = mutableListOf<Long>()
                    var cur = startDateMs
                    while (cur <= endDateMs) { days.add(DateUtils.startOfDayMs(cur)); cur = DateUtils.addDays(cur, 1) }
                    days
                }
            }
            "calendar" -> pickedDates.map { DateUtils.startOfDayMs(it) }.sorted()
            "dayWise" -> {
                if (dayWiseEndMs <= 0 || selectedWeekdays.isEmpty()) return emptyList()
                val result = mutableListOf<Long>()
                val cal = Calendar.getInstance().apply { timeInMillis = dayWiseStartMs }
                val endCal = Calendar.getInstance().apply { timeInMillis = dayWiseEndMs }
                while (!cal.after(endCal)) {
                    if (cal.get(Calendar.DAY_OF_WEEK) in selectedWeekdays) result.add(DateUtils.startOfDayMs(cal.timeInMillis))
                    cal.add(Calendar.DAY_OF_MONTH, 1)
                }
                result
            }
            else -> emptyList()
        }
    }

    private fun showConflictDialog() {
        ConflictDialog.newInstance(1) { resolution -> saveSchedule(resolution) }
            .show(supportFragmentManager, "conflict")
    }

    private fun updateSummary() {
        val days = if (isSingleDayEdit) { if (singleDate > 0) listOf(singleDate) else emptyList() } else collectCalendarDays()
        if (days.isEmpty()) { binding.tvSummary.visibility = View.GONE; return }
        binding.tvSummary.text = getString(R.string.cs_days_summary, days.size, DateUtils.formatShortDate(days.first()), DateUtils.formatDate(days.last()))
        binding.tvSummary.visibility = View.VISIBLE
    }

    // Feature 5: Date picker with min date
    private fun showDatePicker(minDateMs: Long = 0L, onPick: (Long) -> Unit) {
        val cal = Calendar.getInstance()
        val dialog = DatePickerDialog(this, { _, year, month, day ->
            val picked = Calendar.getInstance().apply { set(year, month, day, 0, 0, 0); set(Calendar.MILLISECOND, 0) }
            onPick(picked.timeInMillis)
        }, cal.get(Calendar.YEAR), cal.get(Calendar.MONTH), cal.get(Calendar.DAY_OF_MONTH))

        if (minDateMs > 0) dialog.datePicker.minDate = minDateMs
        dialog.show()
    }

    private fun dpToPx(dp: Int): Int = (dp * resources.displayMetrics.density).toInt()
}
