package com.zillit.lcw.ui.boxschedule.list

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import com.google.android.material.bottomsheet.BottomSheetDialogFragment
import com.google.android.material.chip.Chip
import com.zillit.lcw.R
import com.zillit.lcw.databinding.SheetListFiltersBinding

/**
 * ListFiltersBottomSheet — consolidated filter UI (type + content kind).
 * Search lives inline on the toolbar and is NOT part of this sheet.
 *
 * Holds draft state locally; Apply commits to the caller via [Listener.onApply], Reset clears
 * inputs without closing. Caller passes the currently-applied filters so the sheet opens
 * pre-populated (matches the user's expectation: "click filter → see applied filters").
 */
class ListFiltersBottomSheet : BottomSheetDialogFragment() {

    data class Filters(
        val searchQuery: String = "",
        val typeFilter: String = "", // "" = All Types
        val contentFilter: String = "all" // "all" | "schedules" | "events" | "notes"
    ) {
        val activeCount: Int
            get() {
                var n = 0
                if (searchQuery.isNotBlank()) n++
                if (typeFilter.isNotBlank()) n++
                if (contentFilter != "all") n++
                return n
            }
    }

    interface Listener {
        fun onApply(filters: Filters)
    }

    private var _binding: SheetListFiltersBinding? = null
    private val binding get() = _binding!!

    private var draft = Filters()
    private var typeLabels: List<String> = emptyList()

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?
    ): View {
        _binding = SheetListFiltersBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        // Seed draft + UI from arguments — searchQuery passes through unchanged (not editable here).
        val initial = Filters(
            searchQuery = arguments?.getString(ARG_SEARCH).orEmpty(),
            typeFilter = arguments?.getString(ARG_TYPE).orEmpty(),
            contentFilter = arguments?.getString(ARG_CONTENT) ?: "all"
        )
        typeLabels = arguments?.getStringArrayList(ARG_TYPE_LABELS).orEmpty()
        draft = initial

        setupTypeChips(initial.typeFilter)
        setupContentToggle(initial.contentFilter)
        setupButtons()
        refreshClearLink()
        refreshTypeSectionVisibility()
    }

    /** Type filter only applies to schedules — hide its section when Show is Events/Notes. */
    private fun refreshTypeSectionVisibility() {
        val relevant = draft.contentFilter == "all" || draft.contentFilter == "schedules"
        binding.typeSection.visibility = if (relevant) View.VISIBLE else View.GONE
        // Drop any previously-set type so we don't apply a hidden filter.
        if (!relevant && draft.typeFilter.isNotEmpty()) {
            draft = draft.copy(typeFilter = "")
            (binding.chipGroupType.getChildAt(0) as? Chip)?.isChecked = true
        }
    }

    private fun setupTypeChips(initialType: String) {
        val group = binding.chipGroupType
        group.removeAllViews()

        val allLabel = getString(R.string.bs_all_types)
        val labels = listOf(allLabel) + typeLabels

        labels.forEachIndexed { index, label ->
            val chip = Chip(requireContext()).apply {
                text = label
                isCheckable = true
                isCheckedIconVisible = false
            }
            // Give each chip a stable id so restoration works.
            chip.id = View.generateViewId()
            group.addView(chip)

            val isAll = index == 0
            val isSelected = if (isAll) initialType.isEmpty()
            else label.equals(initialType, ignoreCase = true)
            chip.isChecked = isSelected

            chip.setOnClickListener {
                // Force check (ChipGroup with selectionRequired=true handles deselect of siblings).
                chip.isChecked = true
                draft = draft.copy(typeFilter = if (isAll) "" else label)
                refreshClearLink()
            }
        }
    }

    private fun setupContentToggle(initialContent: String) {
        val checkedId = when (initialContent) {
            "schedules" -> R.id.btnSheetFilterSchedules
            "events" -> R.id.btnSheetFilterEvents
            "notes" -> R.id.btnSheetFilterNotes
            else -> R.id.btnSheetFilterAll
        }
        binding.contentFilterSheetToggle.check(checkedId)
        binding.contentFilterSheetToggle.addOnButtonCheckedListener { _, id, isChecked ->
            if (!isChecked) return@addOnButtonCheckedListener
            val value = when (id) {
                R.id.btnSheetFilterSchedules -> "schedules"
                R.id.btnSheetFilterEvents -> "events"
                R.id.btnSheetFilterNotes -> "notes"
                else -> "all"
            }
            draft = draft.copy(contentFilter = value)
            refreshClearLink()
            refreshTypeSectionVisibility()
        }
    }

    private fun setupButtons() {
        binding.btnCloseFilter.setOnClickListener { dismiss() }
        binding.btnFilterReset.setOnClickListener {
            binding.contentFilterSheetToggle.check(R.id.btnSheetFilterAll)
            // Re-check the "All Types" chip (always first).
            (binding.chipGroupType.getChildAt(0) as? Chip)?.isChecked = true
            // Preserve searchQuery — it's owned by the toolbar, not this sheet.
            draft = draft.copy(typeFilter = "", contentFilter = "all")
            refreshClearLink()
        }
        binding.btnFilterApply.setOnClickListener {
            (parentFragment as? Listener ?: activity as? Listener)?.onApply(draft)
            dismiss()
        }
    }

    private fun refreshClearLink() {
        val hasActive = draft.typeFilter.isNotEmpty() || draft.contentFilter != "all"
        binding.btnFilterReset.visibility = if (hasActive) View.VISIBLE else View.GONE
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }

    companion object {
        private const val ARG_SEARCH = "arg_search"
        private const val ARG_TYPE = "arg_type"
        private const val ARG_CONTENT = "arg_content"
        private const val ARG_TYPE_LABELS = "arg_type_labels"

        fun newInstance(current: Filters, typeLabels: List<String>): ListFiltersBottomSheet {
            return ListFiltersBottomSheet().apply {
                arguments = Bundle().apply {
                    putString(ARG_SEARCH, current.searchQuery)
                    putString(ARG_TYPE, current.typeFilter)
                    putString(ARG_CONTENT, current.contentFilter)
                    putStringArrayList(ARG_TYPE_LABELS, ArrayList(typeLabels))
                }
            }
        }
    }
}
