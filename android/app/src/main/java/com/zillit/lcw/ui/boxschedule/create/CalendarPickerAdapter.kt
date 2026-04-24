package com.zillit.lcw.ui.boxschedule.create

import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.RecyclerView
import com.zillit.lcw.R
import com.zillit.lcw.databinding.NewBoxItemCalendarPickerCellBinding

/**
 * Month-grid date picker adapter — mirrors iOS CreateScheduleView calendar tab.
 * 42 cells (6 weeks × 7 days). Selected cells get a dark fill + white text.
 * Locked (fixed) cells get the primary accent color and can't be toggled.
 * Past cells and cells from adjacent months are disabled.
 */
class CalendarPickerAdapter(
    private val onToggle: (Long) -> Unit,
) : RecyclerView.Adapter<CalendarPickerAdapter.VH>() {

    data class Cell(
        val epochMs: Long,
        val dayNumber: Int,
        val isCurrentMonth: Boolean,
        val isPast: Boolean,
        val isSelected: Boolean,
        val isLocked: Boolean,
    )

    private var cells: List<Cell> = emptyList()

    fun submit(newCells: List<Cell>) {
        cells = newCells
        notifyDataSetChanged()
    }

    inner class VH(val binding: NewBoxItemCalendarPickerCellBinding) : RecyclerView.ViewHolder(binding.root) {
        fun bind(cell: Cell) {
            val ctx = binding.root.context
            binding.tvDay.text = cell.dayNumber.toString()

            val bg = GradientDrawable().apply {
                cornerRadius = 6f * ctx.resources.displayMetrics.density
                setColor(
                    when {
                        cell.isLocked -> ContextCompat.getColor(ctx, R.color.primaryAccent)
                        cell.isSelected -> ContextCompat.getColor(ctx, R.color.solidDark)
                        else -> Color.TRANSPARENT
                    }
                )
            }
            binding.tvDay.background = bg

            val textColor = when {
                cell.isLocked || cell.isSelected -> ContextCompat.getColor(ctx, R.color.solidDarkText)
                cell.isPast || !cell.isCurrentMonth -> ContextCompat.getColor(ctx, R.color.textDisabled)
                else -> ContextCompat.getColor(ctx, R.color.textBody)
            }
            binding.tvDay.setTextColor(textColor)
            binding.tvDay.setTypeface(
                null,
                if (cell.isSelected || cell.isLocked) android.graphics.Typeface.BOLD
                else android.graphics.Typeface.NORMAL
            )

            val disabled = cell.isPast || !cell.isCurrentMonth || cell.isLocked
            binding.tvDay.isEnabled = !disabled
            binding.tvDay.alpha = if (!cell.isCurrentMonth) 0.3f else 1f

            binding.tvDay.setOnClickListener {
                if (!disabled) onToggle(cell.epochMs)
            }
        }
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): VH {
        val binding = NewBoxItemCalendarPickerCellBinding.inflate(
            LayoutInflater.from(parent.context), parent, false
        )
        return VH(binding)
    }

    override fun onBindViewHolder(holder: VH, position: Int) {
        holder.bind(cells[position])
    }

    override fun getItemCount(): Int = cells.size
}
