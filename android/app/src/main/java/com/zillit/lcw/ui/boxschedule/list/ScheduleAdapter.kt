package com.zillit.lcw.ui.boxschedule.list

import android.graphics.drawable.GradientDrawable
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.RecyclerView
import com.zillit.lcw.R
import com.zillit.lcw.data.model.ScheduleDay
import com.zillit.lcw.databinding.ItemScheduleDayBinding
import com.zillit.lcw.util.DateUtils
import com.zillit.lcw.util.toColorInt

/**
 * ScheduleAdapter — RecyclerView.Adapter for schedule rows in list view.
 * Shows date, type pill with color dot, title, today badge, expand chevron.
 * Matches web's ScheduleTable row.
 */
class ScheduleAdapter(
    private val onRowClick: (Long) -> Unit
) : RecyclerView.Adapter<ScheduleAdapter.ScheduleViewHolder>() {

    private var items = listOf<ScheduleRow>()
    private var selectMode = false
    private val selectedIds = mutableSetOf<String>()

    data class ScheduleRow(
        val id: String,
        val dateMs: Long,
        val dateText: String,
        val typeName: String,
        val typeColor: String,
        val title: String,
        val isToday: Boolean
    )

    fun submitList(days: List<ScheduleDay>, mode: String) {
        items = when (mode) {
            "bySchedule" -> {
                // Group by schedule, show each schedule as a single row
                days.map { day ->
                    ScheduleRow(
                        id = day.id,
                        dateMs = day.startDate,
                        dateText = "${DateUtils.formatShortDate(day.startDate)} - ${DateUtils.formatShortDate(day.endDate)}",
                        typeName = day.typeName,
                        typeColor = day.color,
                        title = day.title.ifEmpty { getString(R.string.untitled) },
                        isToday = false
                    )
                }
            }
            else -> {
                // By Date: expand each day in the schedule range
                val allRows = mutableListOf<ScheduleRow>()
                for (day in days) {
                    if (day.calendarDays.isNotEmpty()) {
                        for (calDay in day.calendarDays) {
                            allRows.add(ScheduleRow(
                                id = day.id,
                                dateMs = calDay,
                                dateText = DateUtils.formatDayMonth(calDay),
                                typeName = day.typeName,
                                typeColor = day.color,
                                title = day.title,
                                isToday = DateUtils.isToday(calDay)
                            ))
                        }
                    } else {
                        // Compute days from start to end
                        var currentMs = day.startDate
                        while (currentMs <= day.endDate) {
                            allRows.add(ScheduleRow(
                                id = day.id,
                                dateMs = currentMs,
                                dateText = DateUtils.formatDayMonth(currentMs),
                                typeName = day.typeName,
                                typeColor = day.color,
                                title = day.title,
                                isToday = DateUtils.isToday(currentMs)
                            ))
                            currentMs = DateUtils.addDays(currentMs, 1)
                        }
                    }
                }
                allRows.sortBy { it.dateMs }
                allRows
            }
        }
        notifyDataSetChanged()
    }

    fun setSelectMode(enabled: Boolean) {
        selectMode = enabled
        if (!enabled) selectedIds.clear()
        notifyDataSetChanged()
    }

    fun getSelectedIds(): Set<String> = selectedIds.toSet()

    private fun getString(@Suppress("SameParameterValue") resId: Int): String {
        // Fallback for untitled - the actual string is set in bind
        return "(untitled)"
    }

    inner class ScheduleViewHolder(
        private val binding: ItemScheduleDayBinding
    ) : RecyclerView.ViewHolder(binding.root) {

        fun bind(row: ScheduleRow) {
            val context = binding.root.context

            // Date text
            binding.tvDate.text = row.dateText

            // Type pill: color dot + name
            val colorInt = row.typeColor.toColorInt()
            val dotDrawable = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(colorInt)
            }
            binding.dotColor.background = dotDrawable
            binding.tvTypeName.text = row.typeName

            // Title
            binding.tvTitle.text = row.title.ifEmpty {
                context.getString(R.string.untitled)
            }

            // Today badge
            if (row.isToday) {
                binding.tvTodayBadge.visibility = View.VISIBLE
            } else {
                binding.tvTodayBadge.visibility = View.GONE
            }

            // Select mode checkbox
            if (selectMode) {
                binding.cbSelect.visibility = View.VISIBLE
                binding.cbSelect.isChecked = selectedIds.contains(row.id)
                binding.cbSelect.setOnCheckedChangeListener { _, isChecked ->
                    if (isChecked) selectedIds.add(row.id) else selectedIds.remove(row.id)
                }
            } else {
                binding.cbSelect.visibility = View.GONE
            }

            // Row click
            binding.rowContainer.setOnClickListener {
                onRowClick(row.dateMs)
            }

            // Chevron
            binding.ivChevron.setOnClickListener {
                onRowClick(row.dateMs)
            }
        }
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ScheduleViewHolder {
        val binding = ItemScheduleDayBinding.inflate(
            LayoutInflater.from(parent.context), parent, false
        )
        return ScheduleViewHolder(binding)
    }

    override fun onBindViewHolder(holder: ScheduleViewHolder, position: Int) {
        holder.bind(items[position])
    }

    override fun getItemCount(): Int = items.size
}
