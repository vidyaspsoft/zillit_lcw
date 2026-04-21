package com.zillit.lcw.ui.boxschedule.list

import android.content.Context
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.lifecycle.ViewModelProvider
import androidx.recyclerview.widget.LinearLayoutManager
import com.zillit.lcw.R
import com.zillit.lcw.data.model.ScheduleDay
import com.zillit.lcw.databinding.FragmentListBinding
import com.zillit.lcw.ui.boxschedule.BoxScheduleViewModel
import com.zillit.lcw.ui.boxschedule.detail.DayDetailActivity
import com.zillit.lcw.ui.common.SetDefaultPopup
import com.zillit.lcw.util.DateUtils
import com.zillit.lcw.util.showToast

/**
 * ListFragment — By Date / By Schedule list view.
 * Uses LinearLayoutManager + ScheduleAdapter.
 * Handles mode toggle between "byDate" and "bySchedule".
 * Search / type / content-kind filters live in a bottom sheet (see ListFiltersBottomSheet).
 */
class ListFragment : Fragment(), ListFiltersBottomSheet.Listener {

    private var _binding: FragmentListBinding? = null
    private val binding get() = _binding!!

    private lateinit var viewModel: BoxScheduleViewModel
    private lateinit var scheduleAdapter: ScheduleAdapter

    private var listMode = "byDate" // "byDate" or "bySchedule"
    private var isSelectMode = false

    // Applied-filters snapshot mirrors the shared ViewModel state — kept in sync via observers.
    private var appliedFilters = ListFiltersBottomSheet.Filters()

    private val searchQuery get() = appliedFilters.searchQuery
    private val typeFilter get() = appliedFilters.typeFilter
    private val contentFilter get() = appliedFilters.contentFilter

    companion object {
        private const val PREF_KEY = "box-schedule-list-mode"
        private const val PREFS_NAME = "zillit_prefs"
    }

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentListBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        viewModel = ViewModelProvider(requireActivity())[BoxScheduleViewModel::class.java]

        // Restore saved list mode from preferences
        val prefs = requireContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val savedMode = prefs.getString(PREF_KEY, "byDate") ?: "byDate"
        listMode = savedMode

        setupModeToggle()
        setupSelectMode()
        setupList()
        setupSearchInput()
        setupFilterButton()

        // Set initial mode from saved preference
        when (listMode) {
            "byDate" -> binding.listModeToggle.check(R.id.btnByDate)
            "bySchedule" -> binding.listModeToggle.check(R.id.btnBySchedule)
        }
        refreshFilterBadge()

        // Observe data — prefer calendarData (carries nested events/notes) with scheduleDays fallback.
        viewModel.calendarData.observe(viewLifecycleOwner) { applyFilterAndSubmit() }
        viewModel.scheduleDays.observe(viewLifecycleOwner) { applyFilterAndSubmit() }

        // Mirror shared filter state back into the local snapshot so cross-tab edits (e.g. from
        // Calendar view) update the list automatically.
        viewModel.filterSearchText.observe(viewLifecycleOwner) { s ->
            if (appliedFilters.searchQuery != s) {
                appliedFilters = appliedFilters.copy(searchQuery = s)
                if (binding.etListSearch.text?.toString() != s) binding.etListSearch.setText(s)
                refreshFilterBadge()
                applyFilterAndSubmit()
            }
        }
        viewModel.filterTypeName.observe(viewLifecycleOwner) { t ->
            if (appliedFilters.typeFilter != t) {
                appliedFilters = appliedFilters.copy(typeFilter = t)
                refreshFilterBadge(); applyFilterAndSubmit()
            }
        }
        viewModel.filterContentKind.observe(viewLifecycleOwner) { c ->
            if (appliedFilters.contentFilter != c) {
                appliedFilters = appliedFilters.copy(contentFilter = c)
                refreshFilterBadge(); applyFilterAndSubmit()
            }
        }
    }

    /** Prefer calendarData (which carries nested events/notes); fall back to scheduleDays. */
    private fun sourceDays(): List<ScheduleDay> {
        val cal = viewModel.calendarData.value.orEmpty()
        return if (cal.isNotEmpty()) cal else viewModel.scheduleDays.value.orEmpty()
    }

    private fun setupSearchInput() {
        binding.etListSearch.setText(viewModel.filterSearchText.value.orEmpty())
        binding.etListSearch.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                val trimmed = s?.toString()?.trim().orEmpty()
                if (trimmed != viewModel.filterSearchText.value) {
                    viewModel.setFilterSearchText(trimmed)
                }
            }
            override fun afterTextChanged(s: Editable?) {}
        })
    }

    private fun setupFilterButton() {
        binding.btnOpenFilters.setOnClickListener {
            val typeTitles = viewModel.scheduleTypes.value.orEmpty().map { it.title }
            ListFiltersBottomSheet
                .newInstance(appliedFilters, typeTitles)
                .show(childFragmentManager, "list-filters")
        }
    }

    override fun onApply(filters: ListFiltersBottomSheet.Filters) {
        // Push to the shared VM; observers will sync the local snapshot + refresh UI.
        viewModel.setFilterSearchText(filters.searchQuery)
        viewModel.setFilterTypeName(filters.typeFilter)
        viewModel.setFilterContentKind(filters.contentFilter)
    }

    private fun refreshFilterBadge() {
        val count = appliedFilters.activeCount
        if (count == 0) {
            binding.tvFilterBadge.visibility = View.GONE
        } else {
            binding.tvFilterBadge.visibility = View.VISIBLE
            binding.tvFilterBadge.text = count.toString()
        }
    }

    private fun applyFilterAndSubmit() {
        val days = sourceDays()
        val filtered = filterDays(days, searchQuery, typeFilter)

        // Empty-state covers schedules *and* any events/notes the filter would expose.
        val hasSchedules = filtered.isNotEmpty()
        val hasEvents = filtered.any { it.events.isNotEmpty() }
        val hasNotes = filtered.any { it.notes.isNotEmpty() }
        val hasAny = when (contentFilter) {
            "schedules" -> hasSchedules
            "events" -> hasEvents
            "notes" -> hasNotes
            else -> hasSchedules || hasEvents || hasNotes
        }

        if (!hasAny) {
            binding.emptyState.visibility = View.VISIBLE
            binding.scheduleList.visibility = View.GONE
        } else {
            binding.emptyState.visibility = View.GONE
            binding.scheduleList.visibility = View.VISIBLE
            scheduleAdapter.submitList(filtered, listMode, contentFilter)
        }
    }

    private fun filterDays(days: List<ScheduleDay>, query: String, type: String): List<ScheduleDay> {
        val q = query.trim().lowercase()
        return days.filter { day ->
            val matchesType = type.isEmpty() || day.typeName.equals(type, ignoreCase = true)
            if (!matchesType) return@filter false
            if (q.isEmpty()) return@filter true
            val dateStr = "${DateUtils.formatShortDate(day.startDate)} ${DateUtils.formatShortDate(day.endDate)}".lowercase()
            day.title.lowercase().contains(q) ||
                day.typeName.lowercase().contains(q) ||
                dateStr.contains(q)
        }
    }

    private fun setupModeToggle() {
        binding.listModeToggle.addOnButtonCheckedListener { _, checkedId, isChecked ->
            if (!isChecked) return@addOnButtonCheckedListener
            when (checkedId) {
                R.id.btnByDate -> listMode = "byDate"
                R.id.btnBySchedule -> listMode = "bySchedule"
            }
            applyFilterAndSubmit()
        }
    }

    private fun setupSelectMode() {
        binding.btnSelect.setOnClickListener {
            isSelectMode = !isSelectMode
            scheduleAdapter.setSelectMode(isSelectMode)
            binding.btnDeleteSelected.visibility = if (isSelectMode) View.VISIBLE else View.GONE
            binding.btnSelect.text = if (isSelectMode) {
                getString(R.string.action_cancel)
            } else {
                getString(R.string.bs_select)
            }
        }

        binding.btnDeleteSelected.setOnClickListener {
            val selectedIds = scheduleAdapter.getSelectedIds()
            if (selectedIds.isEmpty()) {
                requireContext().showToast(getString(R.string.bs_select))
                return@setOnClickListener
            }
            android.app.AlertDialog.Builder(requireContext())
                .setTitle(getString(R.string.delete_confirm_title))
                .setMessage(getString(R.string.delete_confirm_message))
                .setPositiveButton(getString(R.string.action_delete)) { _, _ ->
                    for (id in selectedIds) {
                        viewModel.deleteDay(id)
                    }
                    isSelectMode = false
                    scheduleAdapter.setSelectMode(false)
                    binding.btnDeleteSelected.visibility = View.GONE
                    binding.btnSelect.text = getString(R.string.bs_select)
                }
                .setNegativeButton(getString(R.string.action_cancel), null)
                .show()
        }

        binding.btnListSetDefault.setOnClickListener { anchor ->
            val prefs = requireContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val current = prefs.getString(PREF_KEY, listMode) ?: listMode
            SetDefaultPopup.show(
                anchor = anchor,
                title = getString(R.string.dv_choose_title),
                subtitle = getString(R.string.dv_list_desc),
                options = listOf(
                    SetDefaultPopup.Option("byDate", getString(R.string.bs_by_date), getString(R.string.dv_by_date_desc)),
                    SetDefaultPopup.Option("bySchedule", getString(R.string.bs_by_schedule), getString(R.string.dv_by_schedule_desc)),
                ),
                currentValue = current,
                onSelect = { value ->
                    prefs.edit().putString(PREF_KEY, value).apply()
                    val modeName = if (value == "byDate") getString(R.string.bs_by_date) else getString(R.string.bs_by_schedule)
                    Toast.makeText(
                        requireContext(),
                        getString(R.string.dv_default_set, modeName),
                        Toast.LENGTH_SHORT
                    ).show()
                    if (value != listMode) {
                        when (value) {
                            "byDate" -> binding.listModeToggle.check(R.id.btnByDate)
                            "bySchedule" -> binding.listModeToggle.check(R.id.btnBySchedule)
                        }
                    }
                },
            )
        }
    }

    private fun setupList() {
        scheduleAdapter = ScheduleAdapter(
            onRowClick = { dayMs -> DayDetailActivity.launch(requireContext(), dayMs) },
            onEditClick = { row -> handleRowEdit(row) },
            onDeleteClick = { row -> handleRowDelete(row) },
            onEventClick = { event -> DayDetailActivity.launch(requireContext(), event.date) },
            onEventEdit = { event -> handleEventEdit(event) },
            onEventDelete = { event -> handleEventDelete(event) }
        )
        binding.scheduleList.layoutManager = LinearLayoutManager(requireContext())
        binding.scheduleList.adapter = scheduleAdapter
    }

    private fun handleEventEdit(event: com.zillit.lcw.data.model.ScheduleEvent) {
        val json = kotlinx.serialization.json.Json.encodeToString(
            com.zillit.lcw.data.model.ScheduleEvent.serializer(), event
        )
        val intent = android.content.Intent(
            requireContext(),
            com.zillit.lcw.ui.boxschedule.create.CreateEventActivity::class.java
        ).apply {
            putExtra("tab", event.eventType)
            putExtra("editing_event_json", json)
        }
        startActivity(intent)
    }

    private fun handleEventDelete(event: com.zillit.lcw.data.model.ScheduleEvent) {
        val title = event.title.ifEmpty { "(untitled)" }
        android.app.AlertDialog.Builder(requireContext())
            .setTitle(getString(R.string.delete_confirm_title))
            .setMessage("Delete \"$title\"?")
            .setPositiveButton(getString(R.string.action_delete)) { _, _ ->
                viewModel.deleteEvent(event.id)
            }
            .setNegativeButton(getString(R.string.action_cancel), null)
            .show()
    }

    private fun handleRowEdit(row: ScheduleAdapter.ScheduleRow) {
        if (row.mode == "byDate") {
            // Single-day edit flow
            com.zillit.lcw.ui.boxschedule.create.CreateScheduleActivity.launchForSingleDayEdit(
                requireContext(), row.day.id, row.day.typeId, row.day.typeName,
                row.dateMs, row.day.numberOfDays, row.day.startDate, row.day.endDate
            )
        } else {
            // Full-schedule edit — pre-fill type + date range
            com.zillit.lcw.ui.boxschedule.create.CreateScheduleActivity.launchForEdit(
                requireContext(), row.day.id, row.day.typeId, row.day.typeName,
                row.day.numberOfDays, row.day.startDate, row.day.endDate
            )
        }
    }

    private fun handleRowDelete(row: ScheduleAdapter.ScheduleRow) {
        val ctx = requireContext()
        val name = "${row.day.typeName}${if (row.day.title.isNotEmpty()) " - ${row.day.title}" else ""}"
        if (row.mode == "byDate") {
            android.app.AlertDialog.Builder(ctx)
                .setTitle(getString(R.string.delete_confirm_title))
                .setMessage("Remove ${DateUtils.formatDate(row.dateMs)} from \"$name\"?")
                .setPositiveButton(getString(R.string.action_delete)) { _, _ ->
                    viewModel.removeDates(listOf(row.day.id to listOf(row.dateMs)))
                }
                .setNegativeButton(getString(R.string.action_cancel), null)
                .show()
        } else {
            android.app.AlertDialog.Builder(ctx)
                .setTitle(getString(R.string.bs_delete_script))
                .setMessage("Delete the entire \"$name\" schedule (${row.day.numberOfDays} day(s))? This cannot be undone.")
                .setPositiveButton(getString(R.string.action_delete)) { _, _ ->
                    viewModel.deleteDay(row.day.id)
                }
                .setNegativeButton(getString(R.string.action_cancel), null)
                .show()
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
