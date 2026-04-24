package com.zillit.lcw.ui.boxschedule.detail

import android.content.Intent
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.view.Gravity
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.content.ContextCompat
import androidx.lifecycle.ViewModelProvider
import com.google.android.material.bottomsheet.BottomSheetDialogFragment
import com.zillit.lcw.R
import com.zillit.lcw.databinding.NewBoxBottomsheetDayDetailBinding
import com.zillit.lcw.ui.boxschedule.BoxScheduleViewModel
import com.zillit.lcw.ui.boxschedule.create.CreateEventActivity
import com.zillit.lcw.ui.boxschedule.create.CreateScheduleActivity
import com.zillit.lcw.util.DateUtils
import com.zillit.lcw.util.lighten
import com.zillit.lcw.util.toColorInt

/**
 * DayDetailBottomSheet — BottomSheetDialogFragment showing day details.
 * Schedules, events, notes, and quick action buttons.
 * Matches web's CalendarView drawer / day detail panel.
 */
class DayDetailBottomSheet : BottomSheetDialogFragment() {

    private var _binding: NewBoxBottomsheetDayDetailBinding? = null
    private val binding get() = _binding!!

    private var dayMs: Long = 0L

    companion object {
        private const val ARG_DAY_MS = "day_ms"

        fun newInstance(dayMs: Long): DayDetailBottomSheet {
            return DayDetailBottomSheet().apply {
                arguments = Bundle().apply {
                    putLong(ARG_DAY_MS, dayMs)
                }
            }
        }
    }

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = NewBoxBottomsheetDayDetailBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        dayMs = arguments?.getLong(ARG_DAY_MS, System.currentTimeMillis()) ?: System.currentTimeMillis()

        val viewModel = ViewModelProvider(requireActivity())[BoxScheduleViewModel::class.java]

        setupHeader()
        setupSchedules(viewModel)
        setupActions()

        // Observe live updates
        viewModel.scheduleDays.observe(viewLifecycleOwner) {
            setupSchedules(viewModel)
        }
    }

    private fun setupHeader() {
        binding.tvDayName.text = DateUtils.formatDayName(dayMs)
        binding.tvFullDate.text = DateUtils.formatDate(dayMs)
    }

    private fun setupSchedules(viewModel: BoxScheduleViewModel) {
        val scheduleDays = viewModel.scheduleDays.value ?: emptyList()
        val dayStart = DateUtils.startOfDayMs(dayMs)

        // Find schedules on this day
        val matchingSchedules = scheduleDays.filter { sd ->
            dayStart in sd.startDate..sd.endDate ||
                sd.calendarDays.any { DateUtils.startOfDayMs(it) == dayStart }
        }

        // Schedule type pills
        binding.pillsContainer.removeAllViews()
        if (matchingSchedules.isNotEmpty()) {
            for (schedule in matchingSchedules) {
                val pill = createSchedulePill(schedule.typeName, schedule.color)
                binding.pillsContainer.addView(pill)
            }
        }

        // Events
        val events = matchingSchedules.flatMap { it.events }
        if (events.isNotEmpty()) {
            binding.tvEventsLabel.visibility = View.VISIBLE
            binding.eventsContainer.removeAllViews()
            for (event in events) {
                val eventView = createEventRow(
                    time = if (event.fullDay) getString(R.string.full_day_label) else DateUtils.formatTime(event.startDateTime),
                    title = event.title,
                    location = event.location
                )
                binding.eventsContainer.addView(eventView)
            }
        } else {
            binding.tvEventsLabel.visibility = View.GONE
        }

        // Notes
        val notes = matchingSchedules.flatMap { it.notes }
        if (notes.isNotEmpty()) {
            binding.tvNotesLabel.visibility = View.VISIBLE
            binding.notesContainer.removeAllViews()
            for (note in notes) {
                val noteView = createNoteRow(note.title, note.notes)
                binding.notesContainer.addView(noteView)
            }
        } else {
            binding.tvNotesLabel.visibility = View.GONE
        }

        // Empty state
        if (matchingSchedules.isEmpty() && events.isEmpty() && notes.isEmpty()) {
            binding.emptyState.visibility = View.VISIBLE
        } else {
            binding.emptyState.visibility = View.GONE
        }
    }

    private fun setupActions() {
        binding.btnAddSchedule.setOnClickListener {
            startActivity(Intent(requireContext(), CreateScheduleActivity::class.java))
            dismiss()
        }

        binding.btnAddEvent.setOnClickListener {
            startActivity(Intent(requireContext(), CreateEventActivity::class.java).apply {
                putExtra("tab", "event")
            })
            dismiss()
        }
    }

    private fun createSchedulePill(typeName: String, color: String): View {
        val context = requireContext()
        val colorInt = color.toColorInt()

        val pill = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            val h = context.resources.getDimensionPixelSize(R.dimen.pill_padding_h)
            val v = context.resources.getDimensionPixelSize(R.dimen.pill_padding_v)
            setPadding(h, v, h, v)
            val bg = GradientDrawable().apply {
                cornerRadius = context.resources.getDimension(R.dimen.radius_sm)
                setColor(colorInt.lighten(0.88f))
            }
            background = bg
            val params = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                marginEnd = context.resources.getDimensionPixelSize(R.dimen.spacing_sm)
            }
            layoutParams = params
        }

        // Dot
        val dotSize = context.resources.getDimensionPixelSize(R.dimen.pill_dot_size)
        val dot = View(context).apply {
            layoutParams = LinearLayout.LayoutParams(dotSize, dotSize).apply {
                marginEnd = context.resources.getDimensionPixelSize(R.dimen.spacing_xs)
            }
            val drawable = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(colorInt)
            }
            background = drawable
        }

        // Label
        val label = TextView(context).apply {
            text = typeName
            setTextColor(ContextCompat.getColor(context, R.color.textBody))
            textSize = 11f
        }

        pill.addView(dot)
        pill.addView(label)
        return pill
    }

    private fun createEventRow(time: String, title: String, location: String): View {
        val context = requireContext()
        val row = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            val pad = context.resources.getDimensionPixelSize(R.dimen.spacing_sm)
            setPadding(0, pad, 0, pad)
        }

        // Time
        val tvTime = TextView(context).apply {
            text = time
            textSize = 12f
            setTextColor(ContextCompat.getColor(context, R.color.textMuted))
            val width = dpToPx(70)
            layoutParams = LinearLayout.LayoutParams(width, ViewGroup.LayoutParams.WRAP_CONTENT)
        }

        // Title + location
        val infoLayout = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f)
        }

        val tvTitle = TextView(context).apply {
            text = title
            textSize = 13f
            setTextColor(ContextCompat.getColor(context, R.color.textPrimary))
        }
        infoLayout.addView(tvTitle)

        if (location.isNotEmpty()) {
            val tvLocation = TextView(context).apply {
                text = location
                textSize = 11f
                setTextColor(ContextCompat.getColor(context, R.color.textSubtle))
            }
            infoLayout.addView(tvLocation)
        }

        row.addView(tvTime)
        row.addView(infoLayout)
        return row
    }

    private fun createNoteRow(title: String, noteText: String): View {
        val context = requireContext()
        val card = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            background = ContextCompat.getDrawable(context, R.drawable.bg_card_rounded)
            val pad = context.resources.getDimensionPixelSize(R.dimen.spacing_md)
            setPadding(pad, pad, pad, pad)
            val params = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                bottomMargin = context.resources.getDimensionPixelSize(R.dimen.spacing_sm)
            }
            layoutParams = params
            setBackgroundColor(ContextCompat.getColor(context, R.color.surfaceNoteCard))
        }

        val tvTitle = TextView(context).apply {
            text = title
            textSize = 13f
            setTextColor(ContextCompat.getColor(context, R.color.textPrimary))
            setTypeface(null, android.graphics.Typeface.BOLD)
        }
        card.addView(tvTitle)

        if (noteText.isNotEmpty()) {
            val tvNote = TextView(context).apply {
                text = noteText
                textSize = 12f
                setTextColor(ContextCompat.getColor(context, R.color.textSecondary))
                val topMargin = context.resources.getDimensionPixelSize(R.dimen.spacing_xs)
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
                ).apply {
                    topMargin.also { this.topMargin = it }
                }
            }
            card.addView(tvNote)
        }

        return card
    }

    private fun dpToPx(dp: Int): Int =
        (dp * resources.displayMetrics.density).toInt()

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
