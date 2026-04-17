package com.zillit.lcw.ui.boxschedule.calendar

import android.content.Context
import android.os.Bundle
import android.view.Gravity
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import android.widget.Toast
import androidx.core.content.ContextCompat
import androidx.fragment.app.Fragment
import androidx.lifecycle.ViewModelProvider
import androidx.recyclerview.widget.GridLayoutManager
import com.zillit.lcw.R
import com.zillit.lcw.databinding.FragmentCalendarBinding
import com.zillit.lcw.ui.boxschedule.BoxScheduleViewModel
import com.zillit.lcw.ui.boxschedule.detail.DayDetailActivity
import com.zillit.lcw.util.DateUtils
import java.util.*

/**
 * CalendarFragment — Month/Week/Day calendar view.
 * Uses GridLayoutManager(7) for month grid. Handles mode toggle,
 * navigation arrows, Today button. Matches web's CalendarView.
 */
class CalendarFragment : Fragment() {

    private var _binding: FragmentCalendarBinding? = null
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
        _binding = FragmentCalendarBinding.inflate(inflater, container, false)
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
    }

    private fun setupSetDefault() {
        binding.btnSetDefault?.setOnClickListener {
            val prefs = requireContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            prefs.edit().putString(PREF_KEY, calendarMode).apply()
            Toast.makeText(
                requireContext(),
                getString(R.string.dv_default_set, calendarMode.replaceFirstChar { it.uppercase() }),
                Toast.LENGTH_SHORT
            ).show()
        }
    }

    private fun setupWeekdayHeaders() {
        val days = arrayOf("MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN")
        binding.weekdayHeaders.removeAllViews()
        for (day in days) {
            val tv = TextView(requireContext()).apply {
                layoutParams = android.widget.LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.MATCH_PARENT, 1f)
                text = day
                gravity = Gravity.CENTER
                setTextColor(ContextCompat.getColor(context, R.color.textMuted))
                textSize = 10f
                typeface = android.graphics.Typeface.create("sans-serif-medium", android.graphics.Typeface.NORMAL)
                letterSpacing = 0.1f
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
        val scheduleDays = viewModel.scheduleDays.value ?: emptyList()

        when (calendarMode) {
            "month" -> {
                val cal = currentCalendar.clone() as Calendar
                cal.set(Calendar.DAY_OF_MONTH, 1)
                // Monday = 2, adjust so Monday is first column
                var dayOfWeek = cal.get(Calendar.DAY_OF_WEEK)
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
                    val daySchedules = scheduleDays.filter { sd ->
                        dayMs in sd.startDate..sd.endDate ||
                            sd.calendarDays.any { DateUtils.startOfDayMs(it) == dayMs }
                    }
                    cells.add(CalendarAdapter.CalendarCell(
                        dateMs = dayMs,
                        dayNumber = d,
                        isCurrentMonth = true,
                        isToday = DateUtils.isToday(dayMs),
                        isWeekend = DateUtils.isWeekend(dayMs),
                        schedules = daySchedules.map { CalendarAdapter.SchedulePill(it.typeName, it.color) }
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
                    val daySchedules = scheduleDays.filter { sd ->
                        dayMs in sd.startDate..sd.endDate
                    }
                    cells.add(CalendarAdapter.CalendarCell(
                        dateMs = dayMs,
                        dayNumber = cal.get(Calendar.DAY_OF_MONTH),
                        isCurrentMonth = true,
                        isToday = DateUtils.isToday(dayMs),
                        isWeekend = DateUtils.isWeekend(dayMs),
                        schedules = daySchedules.map { CalendarAdapter.SchedulePill(it.typeName, it.color) }
                    ))
                    cal.add(Calendar.DAY_OF_MONTH, 1)
                }
            }
        }

        calendarAdapter.submitList(cells)
    }

    private fun populateDayView() {
        // Day view uses the included item_day_focus layout
        // Populate with current day's data
        val dayMs = DateUtils.startOfDayMs(currentCalendar.timeInMillis)
        val dayFocus = binding.dayViewContainer.findViewById<View>(R.id.tvDayFocusNumber)?.parent?.parent as? View
            ?: return

        val tvNumber = dayFocus.findViewById<TextView>(R.id.tvDayFocusNumber)
        val tvDayName = dayFocus.findViewById<TextView>(R.id.tvDayFocusDayName)
        val tvMonthYear = dayFocus.findViewById<TextView>(R.id.tvDayFocusMonthYear)
        val tvTodayBadge = dayFocus.findViewById<TextView>(R.id.tvDayFocusTodayBadge)
        val todayCircle = dayFocus.findViewById<View>(R.id.dayFocusTodayCircle)

        tvNumber?.text = currentCalendar.get(Calendar.DAY_OF_MONTH).toString()
        tvDayName?.text = DateUtils.formatDayName(dayMs)
        tvMonthYear?.text = DateUtils.formatMonthYear(currentCalendar.time).uppercase(Locale.US)

        if (DateUtils.isToday(dayMs)) {
            tvTodayBadge?.visibility = View.VISIBLE
            todayCircle?.visibility = View.VISIBLE
            tvNumber?.setTextColor(ContextCompat.getColor(requireContext(), R.color.calTodayText))
        } else {
            tvTodayBadge?.visibility = View.GONE
            todayCircle?.visibility = View.GONE
            tvNumber?.setTextColor(ContextCompat.getColor(requireContext(), R.color.textSecondary))
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
