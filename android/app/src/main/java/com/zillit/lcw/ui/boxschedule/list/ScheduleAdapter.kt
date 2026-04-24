package com.zillit.lcw.ui.boxschedule.list

import android.graphics.drawable.GradientDrawable
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.RecyclerView
import com.zillit.lcw.R
import com.zillit.lcw.data.model.ScheduleDay
import com.zillit.lcw.data.model.ScheduleEvent
import com.zillit.lcw.databinding.NewBoxItemListEventBinding
import com.zillit.lcw.databinding.NewBoxItemScheduleDayBinding
import com.zillit.lcw.util.DateUtils
import com.zillit.lcw.util.toColorInt

/**
 * ScheduleAdapter — mixed-item list for schedules, events and notes.
 *
 *  - ScheduleRow: the existing schedule-day row with Edit / Delete chips
 *  - EventRow:    event card (colored strip + title + date)
 *  - NoteRow:     note card (colored strip + title + date + notes preview)
 *
 * [submitList] accepts the raw ScheduleDay list, the list-view mode ("byDate" / "bySchedule"),
 * and a content-type filter ("all" / "schedules" / "events" / "notes"). The adapter itself
 * is the canonical ordering/dedup point so callers don't need to pre-merge lists.
 */
class ScheduleAdapter(
    private val onRowClick: (Long) -> Unit,
    private val onEditClick: (ScheduleRow) -> Unit = {},
    private val onDeleteClick: (ScheduleRow) -> Unit = {},
    private val onEventClick: (ScheduleEvent) -> Unit = {},
    private val onEventEdit: (ScheduleEvent) -> Unit = {},
    private val onEventDelete: (ScheduleEvent) -> Unit = {}
) : RecyclerView.Adapter<RecyclerView.ViewHolder>() {

    sealed class ListItem {
        abstract val sortKey: Long
        data class Schedule(val row: ScheduleRow) : ListItem() {
            override val sortKey get() = row.dateMs
        }
        data class EventItem(val event: ScheduleEvent, val kind: String) : ListItem() {
            override val sortKey get() = event.date
        }
    }

    data class ScheduleRow(
        val id: String,
        val dateMs: Long,
        val dateText: String,
        val typeName: String,
        val typeColor: String,
        val title: String,
        val isToday: Boolean,
        val mode: String,
        val day: ScheduleDay
    )

    private var items = listOf<ListItem>()
    private var selectMode = false
    private val selectedIds = mutableSetOf<String>()

    /**
     * @param contentFilter "all" (default) / "schedules" / "events" / "notes"
     */
    fun submitList(days: List<ScheduleDay>, mode: String, contentFilter: String = "all") {
        val result = mutableListOf<ListItem>()

        val showSchedules = contentFilter == "all" || contentFilter == "schedules"
        val showEvents    = contentFilter == "all" || contentFilter == "events"
        val showNotes     = contentFilter == "all" || contentFilter == "notes"

        if (showSchedules) {
            val rows = when (mode) {
                "bySchedule" -> days.map { day ->
                    ScheduleRow(
                        id = day.id,
                        dateMs = day.startDate,
                        dateText = "${DateUtils.formatShortDate(day.startDate)} - ${DateUtils.formatShortDate(day.endDate)}",
                        typeName = day.typeName, typeColor = day.color, title = day.title,
                        isToday = false, mode = mode, day = day
                    )
                }
                else -> {
                    val r = mutableListOf<ScheduleRow>()
                    for (day in days) {
                        val calDays = if (day.calendarDays.isNotEmpty()) day.calendarDays
                        else generateSequence(day.startDate) { if (it <= day.endDate) DateUtils.addDays(it, 1) else null }.toList()
                        for (cd in calDays) {
                            r.add(ScheduleRow(
                                id = day.id, dateMs = cd,
                                dateText = DateUtils.formatDayMonth(cd),
                                typeName = day.typeName, typeColor = day.color,
                                title = day.title, isToday = DateUtils.isToday(cd),
                                mode = mode, day = day
                            ))
                        }
                    }
                    r
                }
            }
            rows.forEach { result.add(ListItem.Schedule(it)) }
        }

        if (showEvents) {
            days.flatMap { it.events }.forEach { result.add(ListItem.EventItem(it, "event")) }
        }
        if (showNotes) {
            days.flatMap { it.notes }.forEach { result.add(ListItem.EventItem(it, "note")) }
        }

        // Chronological order keeps events/notes next to the schedule they belong to.
        items = result.sortedBy { it.sortKey }
        notifyDataSetChanged()
    }

    fun setSelectMode(enabled: Boolean) {
        selectMode = enabled
        if (!enabled) selectedIds.clear()
        notifyDataSetChanged()
    }

    fun getSelectedIds(): Set<String> = selectedIds.toSet()

    override fun getItemViewType(position: Int): Int =
        if (items[position] is ListItem.Schedule) TYPE_SCHEDULE else TYPE_EVENT

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): RecyclerView.ViewHolder {
        val inflater = LayoutInflater.from(parent.context)
        return if (viewType == TYPE_SCHEDULE) {
            ScheduleViewHolder(NewBoxItemScheduleDayBinding.inflate(inflater, parent, false))
        } else {
            EventViewHolder(NewBoxItemListEventBinding.inflate(inflater, parent, false))
        }
    }

    override fun onBindViewHolder(holder: RecyclerView.ViewHolder, position: Int) {
        when (val item = items[position]) {
            is ListItem.Schedule -> (holder as ScheduleViewHolder).bind(item.row)
            is ListItem.EventItem -> (holder as EventViewHolder).bind(item.event, item.kind)
        }
    }

    override fun getItemCount(): Int = items.size

    // ═══════════════════════ SCHEDULE VIEW HOLDER ═══════════════════════

    inner class ScheduleViewHolder(private val binding: NewBoxItemScheduleDayBinding)
        : RecyclerView.ViewHolder(binding.root) {

        fun bind(row: ScheduleRow) {
            val context = binding.root.context
            val isBySchedule = row.mode == "bySchedule"

            binding.byDateLayout.visibility = if (isBySchedule) View.GONE else View.VISIBLE
            binding.byScheduleLayout.visibility = if (isBySchedule) View.VISIBLE else View.GONE

            if (isBySchedule) {
                // iOS-parity "by schedule" card: color square + typeName + day count, date range below.
                binding.colorSquare.background = GradientDrawable().apply {
                    shape = GradientDrawable.RECTANGLE
                    setColor(row.typeColor.toColorInt())
                    cornerRadius = 3f * context.resources.displayMetrics.density
                }
                binding.tvBlockTypeName.text = row.typeName
                if (row.title.isNotEmpty()) {
                    binding.tvBlockTitle.text = "— ${row.title}"
                    binding.tvBlockTitle.visibility = View.VISIBLE
                } else {
                    binding.tvBlockTitle.visibility = View.GONE
                }
                binding.tvDayCount.text = context.resources.getQuantityString(
                    R.plurals.bs_day_count, row.day.numberOfDays, row.day.numberOfDays
                )
                binding.tvDateRange.text = "${DateUtils.formatShortDate(row.day.startDate)} – ${DateUtils.formatShortDate(row.day.endDate)}"

                if (selectMode) {
                    binding.cbSelectBlock.visibility = View.VISIBLE
                    binding.cbSelectBlock.isChecked = selectedIds.contains(row.id)
                    binding.cbSelectBlock.setOnCheckedChangeListener { _, isChecked ->
                        if (isChecked) selectedIds.add(row.id) else selectedIds.remove(row.id)
                    }
                } else {
                    binding.cbSelectBlock.visibility = View.GONE
                }

                binding.byScheduleLayout.setOnClickListener { onRowClick(row.dateMs) }
            } else {
                // By Date — original single-row layout.
                binding.tvDate.text = row.dateText
                binding.dotColor.background = GradientDrawable().apply {
                    shape = GradientDrawable.OVAL
                    setColor(row.typeColor.toColorInt())
                }
                binding.tvTypeName.text = row.typeName
                binding.tvTitle.text = row.title
                binding.tvTitle.visibility = if (row.title.isEmpty()) View.GONE else View.VISIBLE
                binding.tvTodayBadge.visibility = if (row.isToday) View.VISIBLE else View.GONE

                if (selectMode) {
                    binding.cbSelect.visibility = View.VISIBLE
                    binding.cbSelect.isChecked = selectedIds.contains(row.id)
                    binding.cbSelect.setOnCheckedChangeListener { _, isChecked ->
                        if (isChecked) selectedIds.add(row.id) else selectedIds.remove(row.id)
                    }
                } else {
                    binding.cbSelect.visibility = View.GONE
                }

                binding.byDateLayout.setOnClickListener { onRowClick(row.dateMs) }
                binding.ivChevron.setOnClickListener { onRowClick(row.dateMs) }
            }

            binding.btnRowEdit.setOnClickListener { onEditClick(row) }
            binding.btnRowDelete.setOnClickListener { onDeleteClick(row) }
            binding.btnRowDelete.text = if (isBySchedule)
                context.getString(R.string.bs_delete_script)
            else context.getString(R.string.action_delete)
        }
    }

    // ═══════════════════════ EVENT / NOTE VIEW HOLDER ═══════════════════════

    inner class EventViewHolder(private val binding: NewBoxItemListEventBinding)
        : RecyclerView.ViewHolder(binding.root) {

        fun bind(event: ScheduleEvent, kind: String) {
            val context = binding.root.context
            val color = event.color.ifEmpty { "#3498DB" }.toColorInt()
            binding.leColorStrip.setBackgroundColor(color)
            binding.leKindBadge.text = if (kind == "note") "NOTE" else "EVENT"
            binding.leKindBadge.setTextColor(color)
            binding.leTitle.text = event.title.ifEmpty { "(untitled)" }
            binding.leDate.text = if (event.date > 0)
                DateUtils.formatDayMonth(event.date) else ""
            val preview = event.description.ifEmpty { event.notes }.ifEmpty { "" }
            if (preview.isNotEmpty()) {
                binding.leDetails.visibility = View.VISIBLE
                binding.leDetails.text = preview
            } else {
                binding.leDetails.visibility = View.GONE
            }
            binding.root.setOnClickListener { onEventClick(event) }
            binding.leBtnEdit.setOnClickListener { onEventEdit(event) }
            binding.leBtnDelete.setOnClickListener { onEventDelete(event) }
        }
    }

    companion object {
        private const val TYPE_SCHEDULE = 1
        private const val TYPE_EVENT = 2
    }
}
