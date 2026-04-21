package com.zillit.lcw.ui.boxschedule.history

import android.app.DatePickerDialog
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.AdapterView
import android.widget.ArrayAdapter
import androidx.activity.viewModels
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.zillit.lcw.R
import com.zillit.lcw.data.model.ActivityLog
import com.zillit.lcw.databinding.ActivityHistoryBinding
import com.zillit.lcw.databinding.ItemHistoryCardBinding
import com.zillit.lcw.ui.boxschedule.BoxScheduleViewModel
import com.zillit.lcw.util.DateUtils
import java.util.*

/**
 * HistoryActivity — full-screen activity showing activity history (web parity: ActivityLogDrawer).
 * Previously was a BottomSheetDialogFragment; now opens as a page so it matches the web page-style.
 */
class HistoryActivity : AppCompatActivity() {

    private lateinit var binding: ActivityHistoryBinding
    private val viewModel: BoxScheduleViewModel by viewModels()
    private lateinit var historyAdapter: HistoryAdapter
    private var filterAction = "all"
    private var filterDate: Long? = null
    private var allLogs: List<ActivityLog> = emptyList()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityHistoryBinding.inflate(layoutInflater)
        setContentView(binding.root)

        binding.btnHistoryBack.setOnClickListener { finish() }

        setupFilter()
        setupDatePicker()
        setupHistoryList()
        observeViewModel()

        viewModel.fetchActivityLog()
        viewModel.fetchRevisions()
    }

    private fun observeViewModel() {
        viewModel.activityLogs.observe(this) { logs ->
            allLogs = logs
            applyFilters()
        }
        viewModel.revisions.observe(this) { applyFilters() }
    }

    private fun setupFilter() {
        val filterOptions = arrayOf(
            getString(R.string.history_all_actions),
            getString(R.string.history_added),
            getString(R.string.history_changed),
            getString(R.string.history_removed),
            getString(R.string.history_copied),
            getString(R.string.history_shared)
        )
        binding.spinnerFilter.adapter = ArrayAdapter(
            this, android.R.layout.simple_spinner_dropdown_item, filterOptions
        )
        binding.spinnerFilter.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
            override fun onItemSelected(parent: AdapterView<*>?, view: View?, position: Int, id: Long) {
                filterAction = when (position) {
                    1 -> "created"; 2 -> "updated"; 3 -> "deleted"
                    4 -> "duplicated"; 5 -> "shared"; else -> "all"
                }
                applyFilters()
            }
            override fun onNothingSelected(parent: AdapterView<*>?) {}
        }
    }

    private fun setupDatePicker() {
        binding.btnPickDate.setOnClickListener {
            val cal = Calendar.getInstance()
            DatePickerDialog(this, { _, year, month, day ->
                val selected = Calendar.getInstance().apply {
                    set(year, month, day, 0, 0, 0); set(Calendar.MILLISECOND, 0)
                }
                filterDate = selected.timeInMillis
                binding.btnPickDate.text = DateUtils.formatDate(selected.timeInMillis)
                val startOfDay = DateUtils.startOfDayMs(selected.timeInMillis)
                val endOfDay = startOfDay + 86_400_000L - 1L
                viewModel.fetchActivityLog(startDate = startOfDay, endDate = endOfDay)
            }, cal.get(Calendar.YEAR), cal.get(Calendar.MONTH), cal.get(Calendar.DAY_OF_MONTH)).show()
        }
    }

    private fun setupHistoryList() {
        historyAdapter = HistoryAdapter()
        binding.historyList.layoutManager = LinearLayoutManager(this)
        binding.historyList.adapter = historyAdapter
    }

    private fun applyFilters() {
        val filtered = allLogs.filter { log ->
            val actionMatch = filterAction == "all" || log.action == filterAction
            val dateMatch = if (filterDate != null) {
                DateUtils.startOfDayMs(log.createdAt) == DateUtils.startOfDayMs(filterDate!!)
            } else true
            actionMatch && dateMatch
        }
        if (filtered.isEmpty()) {
            binding.emptyState.visibility = View.VISIBLE
            binding.historyList.visibility = View.GONE
            if (filterAction != "all" || filterDate != null) {
                binding.emptyState.findViewById<android.widget.TextView>(binding.emptyState.getChildAt(1).id)?.text =
                    getString(R.string.history_no_match)
            }
        } else {
            binding.emptyState.visibility = View.GONE
            binding.historyList.visibility = View.VISIBLE
            historyAdapter.submitList(filtered)
        }
    }

    inner class HistoryAdapter : RecyclerView.Adapter<HistoryAdapter.HistoryViewHolder>() {
        private var items = listOf<ActivityLog>()
        fun submitList(newItems: List<ActivityLog>) { items = newItems; notifyDataSetChanged() }

        inner class HistoryViewHolder(private val binding: ItemHistoryCardBinding) : RecyclerView.ViewHolder(binding.root) {
            fun bind(item: ActivityLog) {
                val ctx = binding.root.context
                val actionColor = when (item.action) {
                    "created" -> ContextCompat.getColor(ctx, R.color.actionAdded)
                    "updated" -> ContextCompat.getColor(ctx, R.color.actionChanged)
                    "deleted" -> ContextCompat.getColor(ctx, R.color.actionRemoved)
                    "duplicated" -> ContextCompat.getColor(ctx, R.color.actionCopied)
                    "shared" -> ContextCompat.getColor(ctx, R.color.actionShared)
                    else -> ContextCompat.getColor(ctx, R.color.textMuted)
                }
                binding.borderStrip.setBackgroundColor(actionColor)
                binding.actionDot.background = GradientDrawable().apply { shape = GradientDrawable.OVAL; setColor(actionColor) }
                binding.tvActionLabel.text = when (item.action) {
                    "created" -> ctx.getString(R.string.history_label_added)
                    "updated" -> ctx.getString(R.string.history_label_changed)
                    "deleted" -> ctx.getString(R.string.history_label_removed)
                    "duplicated" -> ctx.getString(R.string.history_label_copied)
                    "shared" -> ctx.getString(R.string.history_label_shared)
                    else -> item.action.uppercase()
                }
                binding.tvActionLabel.setTextColor(actionColor)
                binding.tvTargetType.text = when (item.targetType) {
                    "schedule_day" -> ctx.getString(R.string.history_target_schedule)
                    "schedule_type" -> ctx.getString(R.string.history_target_schedule_type)
                    "event" -> ctx.getString(R.string.history_target_event)
                    "note" -> ctx.getString(R.string.history_target_note)
                    else -> item.targetType
                }
                binding.tvHistoryTitle.text = "\u201C${item.targetTitle}\u201D"
                if (item.details.isNotEmpty()) {
                    binding.tvDetails.text = item.details; binding.tvDetails.visibility = View.VISIBLE
                } else binding.tvDetails.visibility = View.GONE
                binding.tvDateTime.text = DateUtils.formatDate(item.createdAt)
                // API no longer returns performedBy.name — resolve from locally-stored current user,
                // otherwise show "Someone". When a full users cache is added, look up by userId here.
                val prefs = ctx.getSharedPreferences("zillit_prefs", android.content.Context.MODE_PRIVATE)
                val currentUserId = prefs.getString("user_id", "") ?: ""
                val currentUserName = prefs.getString("user_name", "") ?: ""
                val performerName = when {
                    item.performedBy.name.isNotEmpty() -> item.performedBy.name
                    item.performedBy.userId == currentUserId && currentUserName.isNotEmpty() -> currentUserName
                    else -> ctx.getString(R.string.history_someone)
                }
                binding.tvByName.text = ctx.getString(R.string.history_by_name, performerName)

                // Match activity-log entry to revision by ±10s (web parity)
                val matched = viewModel.revisions.value.orEmpty()
                    .minByOrNull { kotlin.math.abs(it.createdAt - item.createdAt) }
                    ?.takeIf { kotlin.math.abs(it.createdAt - item.createdAt) <= 10_000L }
                if (matched != null) {
                    binding.tvRevPill.visibility = View.VISIBLE
                    binding.tvRevPill.text = ctx.getString(R.string.rev_label, matched.revisionNumber)
                } else binding.tvRevPill.visibility = View.GONE
            }
        }

        override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): HistoryViewHolder =
            HistoryViewHolder(ItemHistoryCardBinding.inflate(LayoutInflater.from(parent.context), parent, false))

        override fun onBindViewHolder(holder: HistoryViewHolder, position: Int) = holder.bind(items[position])
        override fun getItemCount(): Int = items.size
    }
}
