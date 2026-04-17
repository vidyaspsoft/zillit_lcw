package com.zillit.lcw.ui.boxschedule.list

import android.content.Context
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.lifecycle.ViewModelProvider
import androidx.recyclerview.widget.LinearLayoutManager
import com.zillit.lcw.R
import com.zillit.lcw.databinding.FragmentListBinding
import com.zillit.lcw.ui.boxschedule.BoxScheduleViewModel
import com.zillit.lcw.ui.boxschedule.detail.DayDetailActivity
import com.zillit.lcw.util.showToast

/**
 * ListFragment — By Date / By Schedule list view.
 * Uses LinearLayoutManager + ScheduleAdapter.
 * Handles mode toggle between "byDate" and "bySchedule".
 * Matches web's ScheduleTable component.
 */
class ListFragment : Fragment() {

    private var _binding: FragmentListBinding? = null
    private val binding get() = _binding!!

    private lateinit var viewModel: BoxScheduleViewModel
    private lateinit var scheduleAdapter: ScheduleAdapter

    private var listMode = "byDate" // "byDate" or "bySchedule"
    private var isSelectMode = false

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

        // Set initial mode from saved preference
        when (listMode) {
            "byDate" -> binding.listModeToggle.check(R.id.btnByDate)
            "bySchedule" -> binding.listModeToggle.check(R.id.btnBySchedule)
        }

        // Observe data
        viewModel.scheduleDays.observe(viewLifecycleOwner) { days ->
            if (days.isNullOrEmpty()) {
                binding.emptyState.visibility = View.VISIBLE
                binding.scheduleList.visibility = View.GONE
            } else {
                binding.emptyState.visibility = View.GONE
                binding.scheduleList.visibility = View.VISIBLE
                scheduleAdapter.submitList(days, listMode)
            }
        }
    }

    private fun setupModeToggle() {
        binding.listModeToggle.addOnButtonCheckedListener { _, checkedId, isChecked ->
            if (!isChecked) return@addOnButtonCheckedListener
            when (checkedId) {
                R.id.btnByDate -> {
                    listMode = "byDate"
                    viewModel.scheduleDays.value?.let { scheduleAdapter.submitList(it, listMode) }
                }
                R.id.btnBySchedule -> {
                    listMode = "bySchedule"
                    viewModel.scheduleDays.value?.let { scheduleAdapter.submitList(it, listMode) }
                }
            }
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

        binding.btnListSetDefault.setOnClickListener {
            val prefs = requireContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            prefs.edit().putString(PREF_KEY, listMode).apply()
            val modeName = if (listMode == "byDate") getString(R.string.bs_by_date) else getString(R.string.bs_by_schedule)
            Toast.makeText(
                requireContext(),
                getString(R.string.dv_default_set, modeName),
                Toast.LENGTH_SHORT
            ).show()
        }
    }

    private fun setupList() {
        scheduleAdapter = ScheduleAdapter { dayMs ->
            DayDetailActivity.launch(requireContext(), dayMs)
        }
        binding.scheduleList.layoutManager = LinearLayoutManager(requireContext())
        binding.scheduleList.adapter = scheduleAdapter
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
