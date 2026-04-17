package com.zillit.lcw.ui.boxschedule.history

import android.app.DatePickerDialog
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.AdapterView
import android.widget.ArrayAdapter
import androidx.core.content.ContextCompat
import androidx.lifecycle.ViewModelProvider
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.google.android.material.bottomsheet.BottomSheetDialogFragment
import com.zillit.lcw.R
import com.zillit.lcw.data.model.ActivityLog
import com.zillit.lcw.databinding.BottomsheetHistoryBinding
import com.zillit.lcw.databinding.ItemHistoryCardBinding
import com.zillit.lcw.ui.boxschedule.BoxScheduleViewModel
import com.zillit.lcw.util.DateUtils
import java.util.*

/**
 * HistoryBottomSheet — BottomSheetDialogFragment displaying activity history.
 * Filter spinner + date picker. Wired to API via shared ViewModel.
 * Matches web's ActivityLogDrawer.
 */
class HistoryBottomSheet : BottomSheetDialogFragment() {

    private var _binding: BottomsheetHistoryBinding? = null
    private val binding get() = _binding!!

    private lateinit var viewModel: BoxScheduleViewModel
    private lateinit var historyAdapter: HistoryAdapter
    private var filterAction = "all"
    private var filterDate: Long? = null

    // Full list from API (unfiltered)
    private var allLogs: List<ActivityLog> = emptyList()

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = BottomsheetHistoryBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        viewModel = ViewModelProvider(requireActivity())[BoxScheduleViewModel::class.java]

        setupFilter()
        setupDatePicker()
        setupHistoryList()
        observeViewModel()

        // Load activity log from API
        viewModel.fetchActivityLog()
    }

    private fun observeViewModel() {
        viewModel.activityLogs.observe(viewLifecycleOwner) { logs ->
            allLogs = logs
            applyFilters()
        }
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
            requireContext(),
            android.R.layout.simple_spinner_dropdown_item,
            filterOptions
        )
        binding.spinnerFilter.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
            override fun onItemSelected(parent: AdapterView<*>?, view: View?, position: Int, id: Long) {
                filterAction = when (position) {
                    1 -> "created"
                    2 -> "updated"
                    3 -> "deleted"
                    4 -> "duplicated"
                    5 -> "shared"
                    else -> "all"
                }
                applyFilters()
            }
            override fun onNothingSelected(parent: AdapterView<*>?) {}
        }
    }

    private fun setupDatePicker() {
        binding.btnPickDate.setOnClickListener {
            val cal = Calendar.getInstance()
            DatePickerDialog(requireContext(), { _, year, month, day ->
                val selected = Calendar.getInstance().apply {
                    set(year, month, day, 0, 0, 0)
                    set(Calendar.MILLISECOND, 0)
                }
                filterDate = selected.timeInMillis
                binding.btnPickDate.text = DateUtils.formatDate(selected.timeInMillis)
                applyFilters()
            }, cal.get(Calendar.YEAR), cal.get(Calendar.MONTH), cal.get(Calendar.DAY_OF_MONTH)).show()
        }
    }

    private fun setupHistoryList() {
        historyAdapter = HistoryAdapter()
        binding.historyList.layoutManager = LinearLayoutManager(requireContext())
        binding.historyList.adapter = historyAdapter
    }

    private fun applyFilters() {
        val filtered = allLogs.filter { log ->
            val actionMatch = filterAction == "all" || log.action == filterAction
            val dateMatch = if (filterDate != null) {
                DateUtils.startOfDayMs(log.createdAt) == DateUtils.startOfDayMs(filterDate!!)
            } else {
                true
            }
            actionMatch && dateMatch
        }

        if (filtered.isEmpty()) {
            binding.emptyState.visibility = View.VISIBLE
            binding.historyList.visibility = View.GONE
            if (filterAction != "all" || filterDate != null) {
                binding.tvEmptyTitle.text = getString(R.string.history_no_match)
                binding.tvEmptyDesc.text = getString(R.string.history_no_match_desc)
            } else {
                binding.tvEmptyTitle.text = getString(R.string.history_no_history)
                binding.tvEmptyDesc.text = getString(R.string.history_no_history_desc)
            }
        } else {
            binding.emptyState.visibility = View.GONE
            binding.historyList.visibility = View.VISIBLE
            historyAdapter.submitList(filtered)
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }

    // ── Inner Adapter ──

    inner class HistoryAdapter : RecyclerView.Adapter<HistoryAdapter.HistoryViewHolder>() {

        private var items = listOf<ActivityLog>()

        fun submitList(newItems: List<ActivityLog>) {
            items = newItems
            notifyDataSetChanged()
        }

        inner class HistoryViewHolder(
            private val binding: ItemHistoryCardBinding
        ) : RecyclerView.ViewHolder(binding.root) {

            fun bind(item: ActivityLog) {
                val context = binding.root.context

                // Action color mapping
                val actionColor = when (item.action) {
                    "created" -> ContextCompat.getColor(context, R.color.actionAdded)
                    "updated" -> ContextCompat.getColor(context, R.color.actionChanged)
                    "deleted" -> ContextCompat.getColor(context, R.color.actionRemoved)
                    "duplicated" -> ContextCompat.getColor(context, R.color.actionCopied)
                    "shared" -> ContextCompat.getColor(context, R.color.actionShared)
                    else -> ContextCompat.getColor(context, R.color.textMuted)
                }

                // Left border
                binding.borderStrip.setBackgroundColor(actionColor)

                // Action dot
                val dotDrawable = GradientDrawable().apply {
                    shape = GradientDrawable.OVAL
                    setColor(actionColor)
                }
                binding.actionDot.background = dotDrawable

                // Action label
                val actionLabel = when (item.action) {
                    "created" -> context.getString(R.string.history_label_added)
                    "updated" -> context.getString(R.string.history_label_changed)
                    "deleted" -> context.getString(R.string.history_label_removed)
                    "duplicated" -> context.getString(R.string.history_label_copied)
                    "shared" -> context.getString(R.string.history_label_shared)
                    else -> item.action.uppercase()
                }
                binding.tvActionLabel.text = actionLabel
                binding.tvActionLabel.setTextColor(actionColor)

                // Target type
                val targetType = when (item.targetType) {
                    "schedule_day" -> context.getString(R.string.history_target_schedule)
                    "schedule_type" -> context.getString(R.string.history_target_schedule_type)
                    "event" -> context.getString(R.string.history_target_event)
                    "note" -> context.getString(R.string.history_target_note)
                    else -> item.targetType
                }
                binding.tvTargetType.text = targetType

                // Title in serif quotes
                binding.tvHistoryTitle.text = "\u201C${item.targetTitle}\u201D"

                // Details
                if (item.details.isNotEmpty()) {
                    binding.tvDetails.text = item.details
                    binding.tvDetails.visibility = View.VISIBLE
                } else {
                    binding.tvDetails.visibility = View.GONE
                }

                // Footer
                binding.tvDateTime.text = DateUtils.formatDate(item.createdAt)
                val performerName = if (item.performedBy.name.isNotEmpty()) {
                    item.performedBy.name
                } else {
                    context.getString(R.string.history_someone)
                }
                binding.tvByName.text = context.getString(R.string.history_by_name, performerName)
                binding.tvRevPill.text = context.getString(R.string.rev_label, 1)
            }
        }

        override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): HistoryViewHolder {
            val binding = ItemHistoryCardBinding.inflate(
                LayoutInflater.from(parent.context), parent, false
            )
            return HistoryViewHolder(binding)
        }

        override fun onBindViewHolder(holder: HistoryViewHolder, position: Int) {
            holder.bind(items[position])
        }

        override fun getItemCount(): Int = items.size
    }
}
