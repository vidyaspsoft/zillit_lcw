package com.zillit.lcw.ui.boxschedule.calendar

import android.graphics.drawable.GradientDrawable
import android.view.Gravity
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.zillit.lcw.R
import com.zillit.lcw.databinding.ItemCalendarCellBinding
import com.zillit.lcw.util.toColorInt
import com.zillit.lcw.util.withAlpha

/**
 * CalendarAdapter — RecyclerView.Adapter for calendar cells.
 * Binds date number, today circle, schedule pills, event dots.
 * Handles cell click to open day detail.
 */
class CalendarAdapter(
    private val onCellClick: (Long) -> Unit
) : ListAdapter<CalendarAdapter.CalendarCell, CalendarAdapter.CellViewHolder>(CellDiffCallback()) {

    data class CalendarCell(
        val dateMs: Long,
        val dayNumber: Int,
        val isCurrentMonth: Boolean,
        val isToday: Boolean,
        val isWeekend: Boolean,
        val schedules: List<SchedulePill> = emptyList(),
        val events: List<EventPill> = emptyList(),
        val noteCount: Int = 0,
        val eventCount: Int = 0
    )

    data class SchedulePill(
        val typeName: String,
        val color: String
    )

    data class EventPill(
        val title: String,
        val color: String
    )

    // Drawable caches — avoid allocating a new GradientDrawable on every bind.
    // Keyed by the color int (or alpha-reduced variant) so each unique color is built once.
    private val cellBgCache = HashMap<Int, GradientDrawable>(32)
    private val pillBgCache = HashMap<Int, GradientDrawable>(32)
    private val pillDotCache = HashMap<Int, GradientDrawable>(32)
    private var cachedBorderLight: Int = 0
    private var cachedStrokePx: Int = 0

    inner class CellViewHolder(
        private val binding: ItemCalendarCellBinding
    ) : RecyclerView.ViewHolder(binding.root) {

        fun bind(cell: CalendarCell) {
            val context = binding.root.context

            // Day number
            binding.tvDayNumber.text = cell.dayNumber.toString()

            // Today circle
            if (cell.isToday) {
                binding.todayCircle.visibility = View.VISIBLE
                binding.tvDayNumber.setTextColor(ContextCompat.getColor(context, R.color.calTodayText))
            } else {
                binding.todayCircle.visibility = View.GONE
                val textColor = if (cell.isCurrentMonth) {
                    ContextCompat.getColor(context, R.color.textSecondary)
                } else {
                    ContextCompat.getColor(context, R.color.textDisabled)
                }
                binding.tvDayNumber.setTextColor(textColor)
            }

            // Cell background — mirrors iOS (today circle renders on top regardless):
            //   has schedule → first schedule color @ 5% alpha
            //   weekend → calWeekendBg
            //   else → surface
            val cellBg = when {
                cell.schedules.isNotEmpty() ->
                    cell.schedules.first().color.toColorInt().withAlpha(13) // ~5%
                cell.isWeekend ->
                    ContextCompat.getColor(context, R.color.calWeekendBg)
                else ->
                    ContextCompat.getColor(context, R.color.surface)
            }
            // Build solid bg + subtle gridline border (cached — avoid per-bind alloc)
            if (cachedBorderLight == 0) {
                cachedBorderLight = ContextCompat.getColor(context, R.color.borderLight)
                cachedStrokePx = (0.5f * context.resources.displayMetrics.density).toInt().coerceAtLeast(1)
            }
            binding.root.background = cellBgCache.getOrPut(cellBg) {
                GradientDrawable().apply {
                    setColor(cellBg)
                    setStroke(cachedStrokePx, cachedBorderLight)
                }
            }

            // Dim out-of-month + past-day cells (iOS parity)
            binding.root.alpha = when {
                !cell.isCurrentMonth -> 0.3f
                else -> 1f
            }

            // Combined view — max 2 items (schedules → events → notes) + "+N More"
            binding.pillContainer.removeAllViews()
            binding.eventContainer.removeAllViews()

            val maxVisible = 2
            val totalItems = cell.schedules.size + cell.events.size + (if (cell.noteCount > 0) 1 else 0)
            var shown = 0

            // 1) Schedule pills first
            for (pill in cell.schedules) {
                if (shown >= maxVisible) break
                binding.pillContainer.addView(createPillView(pill, context))
                shown++
            }

            // 2) Events next
            for (evt in cell.events) {
                if (shown >= maxVisible) break
                val row = LinearLayout(context).apply {
                    orientation = LinearLayout.HORIZONTAL
                    gravity = Gravity.CENTER_VERTICAL
                    setPadding(0, dpToPx(1), 0, 0)
                }
                val dot = View(context).apply {
                    val size = dpToPx(5)
                    layoutParams = LinearLayout.LayoutParams(size, size).apply {
                        marginEnd = dpToPx(3)
                    }
                    background = GradientDrawable().apply {
                        shape = GradientDrawable.OVAL
                        setColor(evt.color.toColorInt())
                    }
                }
                val title = TextView(context).apply {
                    text = evt.title
                    textSize = 8f
                    setTextColor(ContextCompat.getColor(context, R.color.textBody))
                    typeface = android.graphics.Typeface.create("sans-serif-medium", android.graphics.Typeface.NORMAL)
                    maxLines = 1
                    ellipsize = android.text.TextUtils.TruncateAt.END
                }
                row.addView(dot)
                row.addView(title)
                binding.eventContainer.addView(row)
                shown++
            }

            // 3) Notes as a single slot
            if (shown < maxVisible && cell.noteCount > 0) {
                val noteText = TextView(context).apply {
                    text = if (cell.noteCount == 1) "1 note" else "${cell.noteCount} notes"
                    textSize = 8f
                    setTextColor(ContextCompat.getColor(context, R.color.textSubtle))
                    setPadding(0, dpToPx(1), 0, 0)
                }
                binding.eventContainer.addView(noteText)
                shown++
            }

            // 4) "+N More" if anything was hidden
            val hidden = totalItems - shown
            if (hidden > 0) {
                val moreView = TextView(context).apply {
                    text = "+$hidden More"
                    setTextColor(ContextCompat.getColor(context, R.color.textSubtle))
                    textSize = 8f
                    typeface = android.graphics.Typeface.DEFAULT_BOLD
                    setPadding(0, dpToPx(1), 0, 0)
                }
                binding.eventContainer.addView(moreView)
            }

            // Click
            binding.root.setOnClickListener { onCellClick(cell.dateMs) }
        }

        private fun createPillView(pill: SchedulePill, context: android.content.Context): View {
            // iOS parity: dot 5pt, text 8pt semibold, pad H=3 V=1, corner 3, bg color @ 0.12 opacity (~31 alpha)
            val colorInt = pill.color.toColorInt()
            val pillBgColor = colorInt.withAlpha(31)
            val pillLayout = LinearLayout(context).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
                val pillHeight = context.resources.getDimensionPixelSize(R.dimen.cal_pill_height)
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT, pillHeight
                ).apply {
                    bottomMargin = dpToPx(1)
                }
                background = pillBgCache.getOrPut(pillBgColor) {
                    GradientDrawable().apply {
                        cornerRadius = dpToPx(3).toFloat()
                        setColor(pillBgColor)
                    }
                }
                val padH = context.resources.getDimensionPixelSize(R.dimen.cal_pill_padding_h)
                val padV = context.resources.getDimensionPixelSize(R.dimen.cal_pill_padding_v)
                setPadding(padH, padV, padH, padV)
            }

            // Color dot
            val dot = View(context).apply {
                val dotSize = context.resources.getDimensionPixelSize(R.dimen.cal_pill_dot)
                layoutParams = LinearLayout.LayoutParams(dotSize, dotSize).apply {
                    marginEnd = dpToPx(2)
                }
                background = pillDotCache.getOrPut(colorInt) {
                    GradientDrawable().apply {
                        shape = GradientDrawable.OVAL
                        setColor(colorInt)
                    }
                }
            }

            // Type name (iOS: size 8 semibold; truncate to 4 chars / "OFF" for Day Off)
            val displayName = if (pill.typeName == "Day Off") "OFF" else pill.typeName.take(4)
            val label = TextView(context).apply {
                text = displayName
                setTextColor(ContextCompat.getColor(context, R.color.textBody))
                textSize = 8f
                typeface = android.graphics.Typeface.create("sans-serif-medium", android.graphics.Typeface.BOLD)
                maxLines = 1
            }

            pillLayout.addView(dot)
            pillLayout.addView(label)
            return pillLayout
        }

        private fun dpToPx(dp: Int): Int =
            (dp * itemView.resources.displayMetrics.density).toInt()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): CellViewHolder {
        val binding = ItemCalendarCellBinding.inflate(
            LayoutInflater.from(parent.context), parent, false
        )
        return CellViewHolder(binding)
    }

    override fun onBindViewHolder(holder: CellViewHolder, position: Int) {
        holder.bind(getItem(position))
    }

    class CellDiffCallback : DiffUtil.ItemCallback<CalendarCell>() {
        override fun areItemsTheSame(oldItem: CalendarCell, newItem: CalendarCell): Boolean =
            oldItem.dateMs == newItem.dateMs

        override fun areContentsTheSame(oldItem: CalendarCell, newItem: CalendarCell): Boolean =
            oldItem == newItem
    }
}
