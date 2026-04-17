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
import com.zillit.lcw.util.lighten
import com.zillit.lcw.util.toColorInt

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
        val eventCount: Int = 0
    )

    data class SchedulePill(
        val typeName: String,
        val color: String
    )

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

            // Weekend background
            if (cell.isWeekend && !cell.isToday) {
                binding.root.setBackgroundColor(ContextCompat.getColor(context, R.color.calWeekendBg))
            } else {
                binding.root.setBackgroundColor(ContextCompat.getColor(context, R.color.surface))
            }

            // Schedule pills (max 2 visible, "+N more" if needed)
            binding.pillContainer.removeAllViews()
            val maxPills = 2
            val visible = cell.schedules.take(maxPills)
            val hidden = cell.schedules.size - maxPills

            for (pill in visible) {
                val pillView = createPillView(pill, context)
                binding.pillContainer.addView(pillView)
            }

            if (hidden > 0) {
                val moreView = TextView(context).apply {
                    text = context.getString(R.string.legend_more, hidden)
                    setTextColor(ContextCompat.getColor(context, R.color.textSubtle))
                    textSize = 9f
                    setPadding(0, dpToPx(1), 0, 0)
                }
                binding.pillContainer.addView(moreView)
            }

            // Event dots
            binding.eventContainer.removeAllViews()
            if (cell.eventCount > 0) {
                val dotRow = LinearLayout(context).apply {
                    orientation = LinearLayout.HORIZONTAL
                    gravity = Gravity.START or Gravity.CENTER_VERTICAL
                }
                for (i in 0 until cell.eventCount.coerceAtMost(3)) {
                    val dot = View(context).apply {
                        val size = context.resources.getDimensionPixelSize(R.dimen.cal_dot_size)
                        layoutParams = LinearLayout.LayoutParams(size, size).apply {
                            marginEnd = dpToPx(2)
                        }
                        val drawable = GradientDrawable().apply {
                            shape = GradientDrawable.OVAL
                            setColor(ContextCompat.getColor(context, R.color.primaryAccent))
                        }
                        background = drawable
                    }
                    dotRow.addView(dot)
                }
                binding.eventContainer.addView(dotRow)
            }

            // Click
            binding.root.setOnClickListener { onCellClick(cell.dateMs) }
        }

        private fun createPillView(pill: SchedulePill, context: android.content.Context): View {
            val pillLayout = LinearLayout(context).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
                val pillHeight = context.resources.getDimensionPixelSize(R.dimen.cal_pill_height)
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT, pillHeight
                ).apply {
                    bottomMargin = dpToPx(1)
                }
                val colorInt = pill.color.toColorInt()
                val bgDrawable = GradientDrawable().apply {
                    cornerRadius = dpToPx(4).toFloat()
                    setColor(colorInt.lighten(0.88f))
                }
                background = bgDrawable
                setPadding(dpToPx(4), 0, dpToPx(4), 0)
            }

            // Color dot
            val dot = View(context).apply {
                val dotSize = context.resources.getDimensionPixelSize(R.dimen.pill_dot_size)
                layoutParams = LinearLayout.LayoutParams(dotSize, dotSize).apply {
                    marginEnd = dpToPx(3)
                }
                val drawable = GradientDrawable().apply {
                    shape = GradientDrawable.OVAL
                    setColor(pill.color.toColorInt())
                }
                background = drawable
            }

            // Type name
            val label = TextView(context).apply {
                text = pill.typeName
                setTextColor(ContextCompat.getColor(context, R.color.textBody))
                textSize = 9f
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
