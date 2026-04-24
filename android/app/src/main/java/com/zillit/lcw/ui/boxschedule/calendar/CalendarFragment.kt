package com.zillit.lcw.ui.boxschedule.calendar

import android.content.Context
import android.content.Intent
import android.content.res.ColorStateList
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.view.Gravity
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.core.content.ContextCompat
import androidx.core.widget.TextViewCompat
import androidx.fragment.app.Fragment
import androidx.lifecycle.ViewModelProvider
import androidx.recyclerview.widget.GridLayoutManager
import com.zillit.lcw.R
import com.zillit.lcw.data.model.ScheduleDay
import com.zillit.lcw.data.model.ScheduleEvent
import com.zillit.lcw.databinding.NewBoxFragmentCalendarBinding
import com.zillit.lcw.ui.boxschedule.BoxScheduleViewModel
import com.zillit.lcw.ui.boxschedule.create.CreateEventActivity
import com.zillit.lcw.ui.boxschedule.create.CreateScheduleActivity
import com.zillit.lcw.ui.boxschedule.detail.DayDetailActivity
import com.zillit.lcw.ui.common.SetDefaultPopup
import com.zillit.lcw.util.DateUtils
import com.zillit.lcw.util.toColorInt
import java.util.*

/**
 * CalendarFragment — Month/Week/Day calendar view.
 * Uses GridLayoutManager(7) for month grid. Handles mode toggle,
 * navigation arrows, Today button. Matches web's CalendarView.
 */
class CalendarFragment : Fragment(),
    com.zillit.lcw.ui.boxschedule.list.ListFiltersBottomSheet.Listener {

    private var _binding: NewBoxFragmentCalendarBinding? = null
    private val binding get() = _binding!!

    private lateinit var viewModel: BoxScheduleViewModel
    private lateinit var calendarAdapter: CalendarAdapter

    private var calendarMode = "month" // "month", "week", "day"
    private var currentCalendar = Calendar.getInstance()

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = NewBoxFragmentCalendarBinding.inflate(inflater, container, false)
        return binding.root
    }

    companion object {
        private const val PREF_KEY = "box-schedule-calendar-mode"
        private const val PREFS_NAME = "zillit_prefs"
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        viewModel = ViewModelProvider(requireActivity())[BoxScheduleViewModel::class.java]

        // Restore saved calendar mode from preferences
        val prefs = requireContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val savedMode = prefs.getString(PREF_KEY, "month") ?: "month"
        calendarMode = savedMode

        setupWeekdayHeaders()
        setupModeToggle()
        setupNavigation()
        setupCalendarGrid()
        setupSetDefault()

        // Set initial mode from saved preference
        when (calendarMode) {
            "month" -> binding.modeToggle.check(R.id.btnMonth)
            "week" -> binding.modeToggle.check(R.id.btnWeek)
            "day" -> binding.modeToggle.check(R.id.btnDay)
        }
        updateCalendarTitle()
        populateGrid()

        // Observe live calendar data updates
        viewModel.calendarData.observe(viewLifecycleOwner) {
            populateGrid()
        }

        // Also observe scheduleDays for grid updates
        viewModel.scheduleDays.observe(viewLifecycleOwner) {
            populateGrid()
        }

        // Shared filter changes — repaint grid + sync inline search field.
        viewModel.filterSearchText.observe(viewLifecycleOwner) { s ->
            if (binding.etCalendarSearch.text?.toString() != s) binding.etCalendarSearch.setText(s)
            refreshFilterBadge(); populateGrid()
        }
        viewModel.filterTypeName.observe(viewLifecycleOwner) { refreshFilterBadge(); populateGrid() }
        viewModel.filterContentKind.observe(viewLifecycleOwner) { refreshFilterBadge(); populateGrid() }

        setupSearchAndFilter()
        refreshFilterBadge()
    }

    private fun setupSearchAndFilter() {
        binding.etCalendarSearch.setText(viewModel.filterSearchText.value.orEmpty())
        binding.etCalendarSearch.addTextChangedListener(object : android.text.TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                val trimmed = s?.toString()?.trim().orEmpty()
                if (trimmed != viewModel.filterSearchText.value) viewModel.setFilterSearchText(trimmed)
            }
            override fun afterTextChanged(s: android.text.Editable?) {}
        })
        binding.btnCalendarOpenFilters.setOnClickListener {
            val typeTitles = viewModel.scheduleTypes.value.orEmpty().map { it.title }
            val current = com.zillit.lcw.ui.boxschedule.list.ListFiltersBottomSheet.Filters(
                searchQuery = viewModel.filterSearchText.value.orEmpty(),
                typeFilter = viewModel.filterTypeName.value.orEmpty(),
                contentFilter = viewModel.filterContentKind.value ?: "all"
            )
            com.zillit.lcw.ui.boxschedule.list.ListFiltersBottomSheet
                .newInstance(current, typeTitles)
                .show(childFragmentManager, "calendar-filters")
        }
    }

    override fun onApply(filters: com.zillit.lcw.ui.boxschedule.list.ListFiltersBottomSheet.Filters) {
        viewModel.setFilterSearchText(filters.searchQuery)
        viewModel.setFilterTypeName(filters.typeFilter)
        viewModel.setFilterContentKind(filters.contentFilter)
    }

    private fun refreshFilterBadge() {
        val count = listOf(
            viewModel.filterSearchText.value.orEmpty().isNotBlank(),
            viewModel.filterTypeName.value.orEmpty().isNotBlank(),
            (viewModel.filterContentKind.value ?: "all") != "all"
        ).count { it }
        if (count == 0) {
            binding.tvCalendarFilterBadge.visibility = View.GONE
        } else {
            binding.tvCalendarFilterBadge.visibility = View.VISIBLE
            binding.tvCalendarFilterBadge.text = count.toString()
        }
    }

    private fun setupSetDefault() {
        binding.btnSetDefault?.setOnClickListener { anchor ->
            val prefs = requireContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val current = prefs.getString(PREF_KEY, calendarMode) ?: calendarMode
            SetDefaultPopup.show(
                anchor = anchor,
                title = getString(R.string.dv_choose_title),
                subtitle = getString(R.string.bs_set_default),
                options = listOf(
                    SetDefaultPopup.Option("month", getString(R.string.bs_month), getString(R.string.dv_month_desc)),
                    SetDefaultPopup.Option("week", getString(R.string.bs_week), getString(R.string.dv_week_desc)),
                    SetDefaultPopup.Option("day", getString(R.string.bs_day), getString(R.string.dv_day_desc)),
                ),
                currentValue = current,
                onSelect = { value ->
                    prefs.edit().putString(PREF_KEY, value).apply()
                    Toast.makeText(
                        requireContext(),
                        getString(R.string.dv_default_set, value.replaceFirstChar { it.uppercase() }),
                        Toast.LENGTH_SHORT
                    ).show()
                    if (value != calendarMode) {
                        when (value) {
                            "month" -> binding.modeToggle.check(R.id.btnMonth)
                            "week" -> binding.modeToggle.check(R.id.btnWeek)
                            "day" -> binding.modeToggle.check(R.id.btnDay)
                        }
                    }
                },
            )
        }
    }

    private fun setupWeekdayHeaders() {
        // iOS parity: size 9 bold, textSubtle color, uppercase, vertical padding 6
        val days = arrayOf("MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN")
        binding.weekdayHeaders.removeAllViews()
        for (day in days) {
            val tv = TextView(requireContext()).apply {
                layoutParams = android.widget.LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.MATCH_PARENT, 1f)
                text = day
                gravity = Gravity.CENTER
                setTextColor(ContextCompat.getColor(context, R.color.textSubtle))
                textSize = 9f
                typeface = android.graphics.Typeface.DEFAULT_BOLD
            }
            binding.weekdayHeaders.addView(tv)
        }
    }

    private fun setupModeToggle() {
        binding.modeToggle.addOnButtonCheckedListener { _, checkedId, isChecked ->
            if (!isChecked) return@addOnButtonCheckedListener
            when (checkedId) {
                R.id.btnMonth -> {
                    calendarMode = "month"
                    showGridMode()
                }
                R.id.btnWeek -> {
                    calendarMode = "week"
                    showGridMode()
                }
                R.id.btnDay -> {
                    calendarMode = "day"
                    showDayMode()
                }
            }
            updateCalendarTitle()
            populateGrid()
        }
    }

    private fun setupNavigation() {
        binding.btnPrev.setOnClickListener {
            when (calendarMode) {
                "month" -> currentCalendar.add(Calendar.MONTH, -1)
                "week" -> currentCalendar.add(Calendar.WEEK_OF_YEAR, -1)
                "day" -> currentCalendar.add(Calendar.DAY_OF_MONTH, -1)
            }
            updateCalendarTitle()
            populateGrid()
        }

        binding.btnNext.setOnClickListener {
            when (calendarMode) {
                "month" -> currentCalendar.add(Calendar.MONTH, 1)
                "week" -> currentCalendar.add(Calendar.WEEK_OF_YEAR, 1)
                "day" -> currentCalendar.add(Calendar.DAY_OF_MONTH, 1)
            }
            updateCalendarTitle()
            populateGrid()
        }

        binding.btnToday.setOnClickListener {
            currentCalendar = Calendar.getInstance()
            updateCalendarTitle()
            populateGrid()
        }
    }

    private fun setupCalendarGrid() {
        calendarAdapter = CalendarAdapter { dayMs ->
            if (calendarMode == "day") return@CalendarAdapter
            // Show day detail bottom sheet on cell click
            DayDetailActivity.launch(requireContext(), dayMs)
        }
        binding.calendarGrid.layoutManager = GridLayoutManager(requireContext(), 7)
        binding.calendarGrid.adapter = calendarAdapter
    }

    private fun showGridMode() {
        binding.calendarGrid.visibility = View.VISIBLE
        binding.dayViewContainer.visibility = View.GONE
        binding.weekdayHeaders.visibility = View.VISIBLE
    }

    private fun showDayMode() {
        binding.calendarGrid.visibility = View.GONE
        binding.dayViewContainer.visibility = View.VISIBLE
        binding.weekdayHeaders.visibility = View.GONE
        populateDayView()
    }

    private fun updateCalendarTitle() {
        val title = when (calendarMode) {
            "month" -> {
                val sdf = java.text.SimpleDateFormat("MMMM yyyy", Locale.US)
                sdf.format(currentCalendar.time).uppercase(Locale.US)
            }
            "week" -> {
                val weekStart = currentCalendar.clone() as Calendar
                weekStart.set(Calendar.DAY_OF_WEEK, Calendar.MONDAY)
                val weekEnd = weekStart.clone() as Calendar
                weekEnd.add(Calendar.DAY_OF_MONTH, 6)
                "${DateUtils.formatShortDate(weekStart.timeInMillis)} - ${DateUtils.formatShortDate(weekEnd.timeInMillis)}"
            }
            "day" -> {
                DateUtils.formatFullDay(currentCalendar.timeInMillis)
            }
            else -> ""
        }
        binding.tvCalTitle.text = title
    }

    private fun populateGrid() {
        if (calendarMode == "day") {
            populateDayView()
            return
        }

        val cells = mutableListOf<CalendarAdapter.CalendarCell>()
        // Use calendarData (from /calendar endpoint) — it includes nested events & notes.
        // scheduleDays (from /days endpoint) has empty events/notes arrays.
        val scheduleDays = viewModel.calendarData.value.takeIf { !it.isNullOrEmpty() }
            ?: viewModel.scheduleDays.value ?: emptyList()

        // Apply shared filters (Show / Type / Search) so the grid mirrors the List view.
        val contentKind = viewModel.filterContentKind.value ?: "all"
        val typeFilter = viewModel.filterTypeName.value.orEmpty()
        val searchQ = viewModel.filterSearchText.value.orEmpty().trim().lowercase()
        val showSchedules = contentKind == "all" || contentKind == "schedules"
        val showEvents = contentKind == "all" || contentKind == "events"
        val showNotes = contentKind == "all" || contentKind == "notes"

        fun matchesSearch(vararg haystack: String?): Boolean {
            if (searchQ.isEmpty()) return true
            return haystack.any { it?.lowercase()?.contains(searchQ) == true }
        }

        // Pre-build O(1) lookup: dayStartMs → list of pills + events + note count (web parity)
        val dayToPills = HashMap<Long, MutableList<CalendarAdapter.SchedulePill>>(scheduleDays.size * 4)
        val dayToEvents = HashMap<Long, MutableList<CalendarAdapter.EventPill>>(scheduleDays.size * 4)
        val dayToNoteCount = HashMap<Long, Int>(scheduleDays.size * 4)
        val oneDayMs = 86_400_000L
        for (sd in scheduleDays) {
            val scheduleMatches = showSchedules &&
                (typeFilter.isEmpty() || sd.typeName.equals(typeFilter, ignoreCase = true)) &&
                matchesSearch(sd.title, sd.typeName)

            if (scheduleMatches) {
                val pill = CalendarAdapter.SchedulePill(sd.typeName, sd.color)
                // Expand date range
                var current = DateUtils.startOfDayMs(sd.startDate)
                val end = DateUtils.startOfDayMs(sd.endDate)
                while (current <= end) {
                    dayToPills.getOrPut(current) { mutableListOf() }.add(pill)
                    current += oneDayMs
                }
                // Include explicit calendar days (may be non-contiguous) and aggregate schedule pills.
                for (calDay in sd.calendarDays) {
                    val dayKey = DateUtils.startOfDayMs(calDay)
                    val list = dayToPills.getOrPut(dayKey) { mutableListOf() }
                    if (!list.contains(pill)) list.add(pill)
                }
            }
            // Events/notes filter independently so Show=Events still works even when
            // the parent schedule block is hidden by Type/Search filters.
            if (showEvents) {
                for (evt in sd.events) {
                    if (!matchesSearch(evt.title, evt.description, evt.notes)) continue
                    val evtDay = DateUtils.startOfDayMs(evt.date)
                    dayToEvents.getOrPut(evtDay) { mutableListOf() }
                        .add(CalendarAdapter.EventPill(evt.title, evt.color.ifEmpty { sd.color }))
                }
            }
            if (showNotes) {
                for (note in sd.notes) {
                    if (!matchesSearch(note.title, note.description, note.notes)) continue
                    val noteDay = DateUtils.startOfDayMs(note.date)
                    dayToNoteCount[noteDay] = (dayToNoteCount[noteDay] ?: 0) + 1
                }
            }
        }

        when (calendarMode) {
            "month" -> {
                val cal = currentCalendar.clone() as Calendar
                cal.set(Calendar.DAY_OF_MONTH, 1)
                // Monday = 2, adjust so Monday is first column
                val dayOfWeek = cal.get(Calendar.DAY_OF_WEEK)
                val offset = if (dayOfWeek == Calendar.SUNDAY) 6 else dayOfWeek - Calendar.MONDAY

                // Previous month padding
                val prevCal = cal.clone() as Calendar
                prevCal.add(Calendar.DAY_OF_MONTH, -offset)
                for (i in 0 until offset) {
                    cells.add(CalendarAdapter.CalendarCell(
                        dateMs = prevCal.timeInMillis,
                        dayNumber = prevCal.get(Calendar.DAY_OF_MONTH),
                        isCurrentMonth = false,
                        isToday = DateUtils.isToday(prevCal.timeInMillis),
                        isWeekend = DateUtils.isWeekend(prevCal.timeInMillis),
                        schedules = emptyList()
                    ))
                    prevCal.add(Calendar.DAY_OF_MONTH, 1)
                }

                // Current month
                val maxDay = cal.getActualMaximum(Calendar.DAY_OF_MONTH)
                for (d in 1..maxDay) {
                    cal.set(Calendar.DAY_OF_MONTH, d)
                    val dayMs = DateUtils.startOfDayMs(cal.timeInMillis)
                    cells.add(CalendarAdapter.CalendarCell(
                        dateMs = dayMs,
                        dayNumber = d,
                        isCurrentMonth = true,
                        isToday = DateUtils.isToday(dayMs),
                        isWeekend = DateUtils.isWeekend(dayMs),
                        schedules = dayToPills[dayMs] ?: emptyList(),
                        events = dayToEvents[dayMs] ?: emptyList(),
                        noteCount = dayToNoteCount[dayMs] ?: 0
                    ))
                }

                // Next month padding to fill grid
                val remaining = (7 - (cells.size % 7)) % 7
                val nextCal = cal.clone() as Calendar
                nextCal.set(Calendar.DAY_OF_MONTH, 1)
                nextCal.add(Calendar.MONTH, 1)
                for (i in 0 until remaining) {
                    cells.add(CalendarAdapter.CalendarCell(
                        dateMs = nextCal.timeInMillis,
                        dayNumber = nextCal.get(Calendar.DAY_OF_MONTH),
                        isCurrentMonth = false,
                        isToday = DateUtils.isToday(nextCal.timeInMillis),
                        isWeekend = DateUtils.isWeekend(nextCal.timeInMillis),
                        schedules = emptyList()
                    ))
                    nextCal.add(Calendar.DAY_OF_MONTH, 1)
                }
            }
            "week" -> {
                val cal = currentCalendar.clone() as Calendar
                cal.set(Calendar.DAY_OF_WEEK, Calendar.MONDAY)
                for (i in 0 until 7) {
                    val dayMs = DateUtils.startOfDayMs(cal.timeInMillis)
                    cells.add(CalendarAdapter.CalendarCell(
                        dateMs = dayMs,
                        dayNumber = cal.get(Calendar.DAY_OF_MONTH),
                        isCurrentMonth = true,
                        isToday = DateUtils.isToday(dayMs),
                        isWeekend = DateUtils.isWeekend(dayMs),
                        schedules = dayToPills[dayMs] ?: emptyList(),
                        events = dayToEvents[dayMs] ?: emptyList(),
                        noteCount = dayToNoteCount[dayMs] ?: 0
                    ))
                    cal.add(Calendar.DAY_OF_MONTH, 1)
                }
            }
        }

        calendarAdapter.submitList(cells)
    }

    private fun populateDayView() {
        // Day view uses the included item_day_focus layout
        val ctx = requireContext()
        val dayMs = DateUtils.startOfDayMs(currentCalendar.timeInMillis)
        val root = binding.dayViewContainer

        val tvNumber = root.findViewById<TextView>(R.id.tvDayFocusNumber)
        val tvDayName = root.findViewById<TextView>(R.id.tvDayFocusDayName)
        val tvMonthYear = root.findViewById<TextView>(R.id.tvDayFocusMonthYear)
        val tvTodayBadge = root.findViewById<TextView>(R.id.tvDayFocusTodayBadge)
        val todayCircle = root.findViewById<View>(R.id.dayFocusTodayCircle)

        tvNumber?.text = currentCalendar.get(Calendar.DAY_OF_MONTH).toString()
        tvDayName?.text = DateUtils.formatDayName(dayMs)
        tvMonthYear?.text = DateUtils.formatMonthYear(currentCalendar.time).uppercase(Locale.US)

        if (DateUtils.isToday(dayMs)) {
            tvTodayBadge?.visibility = View.VISIBLE
            todayCircle?.visibility = View.VISIBLE
            tvNumber?.setTextColor(ContextCompat.getColor(ctx, R.color.calTodayText))
        } else {
            tvTodayBadge?.visibility = View.GONE
            todayCircle?.visibility = View.GONE
            tvNumber?.setTextColor(ContextCompat.getColor(ctx, R.color.textSecondary))
        }

        // Populate schedules / events / notes (iOS parity)
        // calendarData has nested events/notes; scheduleDays does not.
        val isPast = DateUtils.isPast(dayMs)
        val allDays = viewModel.calendarData.value.takeIf { !it.isNullOrEmpty() }
            ?: viewModel.scheduleDays.value ?: emptyList()

        // Apply shared filters so Day view mirrors List + Month/Week views.
        val contentKind = viewModel.filterContentKind.value ?: "all"
        val typeFilter = viewModel.filterTypeName.value.orEmpty()
        val searchQ = viewModel.filterSearchText.value.orEmpty().trim().lowercase()
        val showSchedules = contentKind == "all" || contentKind == "schedules"
        val showEvents = contentKind == "all" || contentKind == "events"
        val showNotes = contentKind == "all" || contentKind == "notes"

        val matching = allDays.filter { sd ->
            // Keep block if it occupies this day AND any of its content survives the filter.
            if (!sd.calendarDays.any { DateUtils.startOfDayMs(it) == dayMs }) return@filter false
            val scheduleOk = showSchedules &&
                (typeFilter.isEmpty() || sd.typeName.equals(typeFilter, ignoreCase = true)) &&
                (searchQ.isEmpty() || sd.title.lowercase().contains(searchQ)
                    || sd.typeName.lowercase().contains(searchQ))
            val hasVisibleEvent = showEvents && sd.events.any {
                DateUtils.startOfDayMs(it.date) == dayMs &&
                    (searchQ.isEmpty() || listOf(it.title, it.description, it.notes)
                        .any { h -> h.lowercase().contains(searchQ) })
            }
            val hasVisibleNote = showNotes && sd.notes.any {
                DateUtils.startOfDayMs(it.date) == dayMs &&
                    (searchQ.isEmpty() || listOf(it.title, it.description, it.notes)
                        .any { h -> h.lowercase().contains(searchQ) })
            }
            scheduleOk || hasVisibleEvent || hasVisibleNote
        }

        renderSchedules(root, matching, isPast, dayMs)
        // Only render events/notes whose `date` matches the selected day — not every event on the block.
        renderEvents(root, matching.flatMap { it.events }.filter { DateUtils.startOfDayMs(it.date) == dayMs }, isPast)
        renderNotes(root, matching.flatMap { it.notes }.filter { DateUtils.startOfDayMs(it.date) == dayMs }, isPast)

        val empty = matching.isEmpty()
        root.findViewById<View>(R.id.dayFocusEmptyState)?.visibility = if (empty) View.VISIBLE else View.GONE
        root.findViewById<TextView>(R.id.tvDayFocusEmptyDesc)?.text =
            ctx.getString(if (isPast) R.string.dd_past else R.string.dd_add_prompt)

        // Actions (Add Schedule / Add Event) — hidden for past dates
        val actions = root.findViewById<View>(R.id.dayFocusActions)
        actions?.visibility = if (isPast) View.GONE else View.VISIBLE
        root.findViewById<View>(R.id.btnDayFocusAddSchedule)?.setOnClickListener {
            CreateScheduleActivity.launchForDate(ctx, dayMs)
        }
        root.findViewById<View>(R.id.btnDayFocusAddEvent)?.setOnClickListener {
            ctx.startActivity(Intent(ctx, CreateEventActivity::class.java).apply {
                putExtra("tab", "event")
            })
        }
    }

    private fun renderSchedules(root: View, schedules: List<ScheduleDay>, isPast: Boolean, dayMs: Long) {
        val ctx = requireContext()
        val label = root.findViewById<TextView>(R.id.tvDayFocusSchedulesLabel)
        val container = root.findViewById<LinearLayout>(R.id.dayFocusScheduleContainer)
        container.removeAllViews()
        if (schedules.isEmpty()) {
            label.visibility = View.GONE
            return
        }
        label.visibility = View.VISIBLE

        for (schedule in schedules) {
            val colorInt = schedule.color.toColorInt()
            val card = LinearLayout(ctx).apply {
                orientation = LinearLayout.VERTICAL
                layoutParams = LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT
                ).apply { bottomMargin = dpToPx(8) }
                background = GradientDrawable().apply {
                    setColor(colorInt and 0x00FFFFFF or 0x10000000)
                    cornerRadius = dpToPx(8).toFloat()
                    setStroke(1, colorInt and 0x00FFFFFF or 0x33000000)
                }
            }

            val infoRow = LinearLayout(ctx).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
                setPadding(dpToPx(12), dpToPx(10), dpToPx(12), dpToPx(10))
            }
            val dot = View(ctx).apply {
                layoutParams = LinearLayout.LayoutParams(dpToPx(12), dpToPx(12)).apply { marginEnd = dpToPx(10) }
                background = GradientDrawable().apply { shape = GradientDrawable.OVAL; setColor(colorInt) }
            }
            val infoCol = LinearLayout(ctx).apply {
                orientation = LinearLayout.VERTICAL
                layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f)
            }
            infoCol.addView(TextView(ctx).apply {
                text = schedule.typeName
                textSize = 14f
                typeface = android.graphics.Typeface.DEFAULT_BOLD
                setTextColor(ContextCompat.getColor(ctx, R.color.textPrimary))
            })
            if (schedule.title.isNotEmpty()) {
                infoCol.addView(TextView(ctx).apply {
                    text = "\"${schedule.title}\""
                    textSize = 12f
                    setTextColor(ContextCompat.getColor(ctx, R.color.textSecondary))
                    typeface = android.graphics.Typeface.create("serif", android.graphics.Typeface.NORMAL)
                })
            }
            infoCol.addView(TextView(ctx).apply {
                text = "${schedule.numberOfDays} day(s) · ${DateUtils.formatShortDate(schedule.startDate)} – ${DateUtils.formatDate(schedule.endDate)}"
                textSize = 11f
                setTextColor(ContextCompat.getColor(ctx, R.color.textMuted))
            })
            infoRow.addView(dot)
            infoRow.addView(infoCol)
            card.addView(infoRow)

            if (!isPast) {
                card.addView(dividerLine(ctx))
                val actions = LinearLayout(ctx).apply {
                    orientation = LinearLayout.HORIZONTAL
                    setPadding(dpToPx(12), dpToPx(6), dpToPx(12), dpToPx(6))
                }
                actions.addView(chipButton(R.string.action_edit, R.drawable.ic_edit, R.color.textLink, R.drawable.bg_chip_link) {
                    // Single-day edit (web parity)
                    CreateScheduleActivity.launchForSingleDayEdit(
                        ctx, schedule.id, schedule.typeId, schedule.typeName,
                        dayMs, schedule.numberOfDays, schedule.startDate, schedule.endDate
                    )
                })
                actions.addView(chipButton(R.string.action_delete, R.drawable.ic_trash, R.color.dangerBg, R.drawable.bg_chip_danger, marginStartDp = 8) {
                    confirmDelete(schedule.id, schedule.typeName + if (schedule.title.isNotEmpty()) " - ${schedule.title}" else "", "schedule")
                })
                // Duplicate chip removed per user request
                card.addView(actions)
            }

            container.addView(card)
        }
    }

    private fun renderEvents(root: View, events: List<ScheduleEvent>, isPast: Boolean) {
        val ctx = requireContext()
        val label = root.findViewById<TextView>(R.id.tvDayFocusEventsLabel)
        val container = root.findViewById<LinearLayout>(R.id.dayFocusEventContainer)
        container.removeAllViews()
        if (events.isEmpty()) { label.visibility = View.GONE; return }
        label.visibility = View.VISIBLE

        for (event in events) {
            val card = LinearLayout(ctx).apply {
                orientation = LinearLayout.VERTICAL
                layoutParams = LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT
                ).apply { bottomMargin = dpToPx(8) }
                background = GradientDrawable().apply {
                    setColor(ContextCompat.getColor(ctx, R.color.surface))
                    cornerRadius = dpToPx(8).toFloat()
                    setStroke(1, ContextCompat.getColor(ctx, R.color.border))
                }
            }
            val infoRow = LinearLayout(ctx).apply {
                orientation = LinearLayout.HORIZONTAL
                setPadding(dpToPx(10), dpToPx(10), dpToPx(10), dpToPx(10))
            }
            val colorBar = View(ctx).apply {
                layoutParams = LinearLayout.LayoutParams(dpToPx(4), ViewGroup.LayoutParams.MATCH_PARENT).apply { marginEnd = dpToPx(10) }
                background = GradientDrawable().apply {
                    setColor(event.color.toColorInt()); cornerRadius = dpToPx(2).toFloat()
                }
            }
            val infoCol = LinearLayout(ctx).apply {
                orientation = LinearLayout.VERTICAL
                layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f)
            }
            if (event.startDateTime > 0) {
                infoCol.addView(TextView(ctx).apply {
                    text = if (event.fullDay) ctx.getString(R.string.full_day_label) else DateUtils.formatTime(event.startDateTime)
                    textSize = 11f
                    typeface = android.graphics.Typeface.DEFAULT_BOLD
                    setTextColor(ContextCompat.getColor(ctx, R.color.textMuted))
                })
            }
            infoCol.addView(TextView(ctx).apply {
                text = event.title; textSize = 14f
                typeface = android.graphics.Typeface.DEFAULT_BOLD
                setTextColor(ContextCompat.getColor(ctx, R.color.textPrimary))
            })
            if (event.location.isNotEmpty()) {
                infoCol.addView(TextView(ctx).apply {
                    text = "📍 ${event.location}"; textSize = 11f
                    setTextColor(ContextCompat.getColor(ctx, R.color.textLink))
                })
            }
            if (event.description.isNotEmpty()) {
                infoCol.addView(TextView(ctx).apply {
                    text = event.description; textSize = 12f; maxLines = 2
                    setTextColor(ContextCompat.getColor(ctx, R.color.textSubtle))
                })
            }
            infoRow.addView(colorBar)
            infoRow.addView(infoCol)
            card.addView(infoRow)

            if (!isPast) {
                card.addView(dividerLine(ctx))
                val actions = LinearLayout(ctx).apply {
                    orientation = LinearLayout.HORIZONTAL
                    setPadding(dpToPx(10), dpToPx(6), dpToPx(10), dpToPx(6))
                }
                actions.addView(chipButton(R.string.action_edit, R.drawable.ic_edit, R.color.textLink, R.drawable.bg_chip_link) {
                    ctx.startActivity(Intent(ctx, CreateEventActivity::class.java).apply { putExtra("tab", "event") })
                })
                actions.addView(chipButton(R.string.action_delete, R.drawable.ic_trash, R.color.dangerBg, R.drawable.bg_chip_danger, marginStartDp = 8) {
                    confirmDelete(event.id, event.title, "event")
                })
                card.addView(actions)
            }

            container.addView(card)
        }
    }

    private fun renderNotes(root: View, notes: List<ScheduleEvent>, isPast: Boolean) {
        val ctx = requireContext()
        val label = root.findViewById<TextView>(R.id.tvDayFocusNotesLabel)
        val container = root.findViewById<LinearLayout>(R.id.dayFocusNoteContainer)
        container.removeAllViews()
        if (notes.isEmpty()) { label.visibility = View.GONE; return }
        label.visibility = View.VISIBLE

        for (note in notes) {
            val card = LinearLayout(ctx).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
                layoutParams = LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT
                ).apply { bottomMargin = dpToPx(8) }
                setPadding(dpToPx(10), dpToPx(10), dpToPx(10), dpToPx(10))
                background = GradientDrawable().apply {
                    setColor(ContextCompat.getColor(ctx, R.color.surfaceNoteCard))
                    cornerRadius = dpToPx(8).toFloat()
                }
            }
            val infoCol = LinearLayout(ctx).apply {
                orientation = LinearLayout.VERTICAL
                layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f)
            }
            infoCol.addView(TextView(ctx).apply {
                text = note.title; textSize = 14f
                typeface = android.graphics.Typeface.DEFAULT_BOLD
                setTextColor(ContextCompat.getColor(ctx, R.color.textPrimary))
            })
            if (note.notes.isNotEmpty()) {
                infoCol.addView(TextView(ctx).apply {
                    text = note.notes; textSize = 12f; maxLines = 3
                    setTextColor(ContextCompat.getColor(ctx, R.color.textSubtle))
                })
            }
            card.addView(infoCol)
            if (!isPast) {
                card.addView(TextView(ctx).apply {
                    text = "🗑"; textSize = 16f
                    setOnClickListener { confirmDelete(note.id, note.title, "event") }
                })
            }
            container.addView(card)
        }
    }

    private fun chipButton(
        textRes: Int,
        iconRes: Int,
        colorRes: Int,
        bgRes: Int,
        marginStartDp: Int = 0,
        onClick: () -> Unit
    ): TextView {
        val ctx = requireContext()
        return TextView(ctx).apply {
            text = getString(textRes)
            textSize = 11f
            typeface = android.graphics.Typeface.create("sans-serif-medium", android.graphics.Typeface.NORMAL)
            setTextColor(ContextCompat.getColor(ctx, colorRes))
            setPadding(dpToPx(10), dpToPx(6), dpToPx(10), dpToPx(6))
            background = ContextCompat.getDrawable(ctx, bgRes)
            setCompoundDrawablesRelativeWithIntrinsicBounds(iconRes, 0, 0, 0)
            compoundDrawablePadding = dpToPx(3)
            TextViewCompat.setCompoundDrawableTintList(this, ColorStateList.valueOf(ContextCompat.getColor(ctx, colorRes)))
            if (marginStartDp > 0) {
                layoutParams = LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT
                ).apply { marginStart = dpToPx(marginStartDp) }
            }
            setOnClickListener { onClick() }
        }
    }

    private fun dividerLine(ctx: Context): View = View(ctx).apply {
        layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 1)
        setBackgroundColor(ContextCompat.getColor(ctx, R.color.borderLight))
    }

    private fun confirmDelete(id: String, name: String, type: String) {
        AlertDialog.Builder(requireContext())
            .setTitle(R.string.delete_confirm_title)
            .setMessage("Are you sure you want to delete \"$name\"? This cannot be undone.")
            .setPositiveButton(R.string.action_delete) { _, _ ->
                if (type == "schedule") viewModel.deleteDay(id) else viewModel.deleteEvent(id)
            }
            .setNegativeButton(R.string.action_cancel, null)
            .show()
    }

    private fun dpToPx(dp: Int): Int = (dp * resources.displayMetrics.density).toInt()

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
