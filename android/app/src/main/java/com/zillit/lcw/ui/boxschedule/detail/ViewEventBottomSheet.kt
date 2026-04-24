package com.zillit.lcw.ui.boxschedule.detail

import android.net.Uri
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.content.ContextCompat
import com.google.android.material.bottomsheet.BottomSheetDialogFragment
import com.zillit.lcw.R
import com.zillit.lcw.data.model.ScheduleEvent
import com.zillit.lcw.databinding.NewBoxBottomsheetViewEventBinding
import com.zillit.lcw.util.DateUtils
import com.zillit.lcw.util.toColorInt

/**
 * ViewEventBottomSheet — read-only event/note detail.
 * Web parity: ViewEventDrawer.jsx — title + time/date + all filled detail rows.
 */
class ViewEventBottomSheet : BottomSheetDialogFragment() {

    private var _binding: NewBoxBottomsheetViewEventBinding? = null
    private val binding get() = _binding!!

    companion object {
        private const val ARG_EVENT_JSON = "event_json"

        fun newInstance(event: ScheduleEvent): ViewEventBottomSheet {
            return ViewEventBottomSheet().apply {
                arguments = Bundle().apply {
                    putString(ARG_EVENT_JSON, kotlinx.serialization.json.Json.encodeToString(ScheduleEvent.serializer(), event))
                }
            }
        }
    }

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = NewBoxBottomsheetViewEventBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        val json = arguments?.getString(ARG_EVENT_JSON) ?: return dismiss()
        val event = kotlinx.serialization.json.Json.decodeFromString(ScheduleEvent.serializer(), json)
        populate(event)
    }

    private fun populate(event: ScheduleEvent) {
        val isEvent = event.eventType == "event"
        binding.tvVeHeaderTitle.text = if (isEvent) "EVENT DETAILS" else "NOTE DETAILS"
        binding.btnVeClose.setOnClickListener { dismiss() }

        // Title + colored left-border bg
        binding.tvVeTitle.text = event.title
        val borderColor = event.color.ifEmpty { "#3498DB" }.toColorInt()
        binding.veHeader.background = android.graphics.drawable.GradientDrawable().apply {
            setColor(ContextCompat.getColor(requireContext(), R.color.surfaceAlt))
            setStroke(0, 0)
        }
        // Add a colored vertical bar via a LayerDrawable (4dp left stripe)
        val stripe = android.graphics.drawable.GradientDrawable().apply { setColor(borderColor) }
        val body = android.graphics.drawable.GradientDrawable().apply {
            setColor(ContextCompat.getColor(requireContext(), R.color.surfaceAlt))
        }
        val layers = android.graphics.drawable.LayerDrawable(arrayOf(stripe, body))
        layers.setLayerInset(1, dpToPx(4), 0, 0, 0)
        binding.veHeader.background = layers

        // Time
        if (isEvent) {
            val timeText = when {
                event.fullDay -> "Full Day"
                event.startDateTime > 0 && event.endDateTime > 0 ->
                    "${DateUtils.formatTime(event.startDateTime)} – ${DateUtils.formatTime(event.endDateTime)}"
                event.startDateTime > 0 -> DateUtils.formatTime(event.startDateTime)
                else -> null
            }
            if (timeText != null) {
                binding.tvVeTime.visibility = View.VISIBLE
                binding.tvVeTime.text = timeText
            }
            if (event.startDateTime > 0) {
                binding.tvVeDate.visibility = View.VISIBLE
                val startStr = DateUtils.formatFullDay(event.startDateTime)
                binding.tvVeDate.text = if (event.endDateTime > 0 && event.endDateTime != event.startDateTime) {
                    "$startStr → ${DateUtils.formatFullDay(event.endDateTime)}"
                } else startStr
            }
        }

        // Detail rows
        binding.veDetailContainer.removeAllViews()

        val desc = event.description.takeIf { it.isNotEmpty() } ?: event.notes.takeIf { it.isNotEmpty() }
        if (desc != null) {
            addRow("📝", if (isEvent) "Description" else "Notes", desc)
        }
        if (event.location.isNotEmpty()) {
            addRow("📍", "Location", event.location, isLink = true) {
                val uri = if (event.locationLat != null && event.locationLng != null) {
                    Uri.parse("geo:${event.locationLat},${event.locationLng}?q=${Uri.encode(event.location)}")
                } else {
                    Uri.parse("geo:0,0?q=${Uri.encode(event.location)}")
                }
                startActivity(android.content.Intent(android.content.Intent.ACTION_VIEW, uri))
            }
        }
        if (event.callType.isNotEmpty()) {
            val label = when (event.callType) {
                "meet_in_person", "in_person" -> "Meet In Person"
                "audio" -> "Audio Call"
                "video" -> "Video Call"
                else -> event.callType
            }
            addRow("📞", "Call Type", label)
        }
        if (event.timezone.isNotEmpty()) addRow("🌐", "Timezone", event.timezone.replace('_', ' '))
        if (event.reminder.isNotEmpty() && event.reminder != "none") {
            val label = when (event.reminder) {
                "at_time" -> "At the time of event"
                "5min" -> "5 minutes before"
                "15min" -> "15 minutes before"
                "30min" -> "30 minutes before"
                "1hr" -> "1 hour before"
                "1day" -> "1 day before"
                else -> event.reminder
            }
            addRow("🔔", "Reminder", label)
        }
        if (event.repeatStatus.isNotEmpty() && event.repeatStatus != "none") {
            val suffix = if (event.repeatEndDate > 0) " until ${DateUtils.formatDate(event.repeatEndDate)}" else ""
            addRow("🔁", "Repeat", "${event.repeatStatus.replaceFirstChar { it.uppercase() }}$suffix")
        }
        if (event.fullDay) addRow("📅", "Duration", "Full Day Event")
    }

    private fun addRow(icon: String, label: String, value: String, isLink: Boolean = false, onClick: (() -> Unit)? = null) {
        val ctx = requireContext()
        val row = LinearLayout(ctx).apply {
            orientation = LinearLayout.HORIZONTAL
            setPadding(0, dpToPx(12), 0, dpToPx(12))
            val divider = View(ctx).apply {
                layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 1)
                setBackgroundColor(ContextCompat.getColor(ctx, R.color.surfaceAlt2))
            }
            // We add divider AFTER the row below
        }
        row.addView(TextView(ctx).apply {
            text = icon
            textSize = 14f
            layoutParams = LinearLayout.LayoutParams(dpToPx(26), ViewGroup.LayoutParams.WRAP_CONTENT)
        })
        val col = LinearLayout(ctx).apply {
            orientation = LinearLayout.VERTICAL
            layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f)
        }
        col.addView(TextView(ctx).apply {
            text = label.uppercase()
            textSize = 11f
            letterSpacing = 0.05f
            setTextColor(ContextCompat.getColor(ctx, R.color.textSubtle))
            typeface = android.graphics.Typeface.DEFAULT_BOLD
        })
        col.addView(TextView(ctx).apply {
            text = value
            textSize = 14f
            setTextColor(ContextCompat.getColor(ctx, if (isLink) R.color.textLink else R.color.textBody))
            if (isLink) paintFlags = paintFlags or android.graphics.Paint.UNDERLINE_TEXT_FLAG
            if (onClick != null) setOnClickListener { onClick() }
        })
        row.addView(col)
        binding.veDetailContainer.addView(row)

        // separator
        val sep = View(ctx).apply {
            layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 1)
            setBackgroundColor(ContextCompat.getColor(ctx, R.color.surfaceAlt2))
        }
        binding.veDetailContainer.addView(sep)
    }

    private fun dpToPx(dp: Int): Int = (dp * resources.displayMetrics.density).toInt()

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
