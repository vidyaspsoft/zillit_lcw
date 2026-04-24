package com.zillit.lcw.ui.boxschedule.create

import android.app.Dialog
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.core.content.ContextCompat
import androidx.fragment.app.DialogFragment
import com.zillit.lcw.R
import com.zillit.lcw.databinding.NewBoxDialogConflictBinding

/**
 * ConflictDialog — Shows Replace/Extend/Overlap options when schedule dates conflict.
 * Returns selection via callback. Matches web's ConflictDialog.
 */
class ConflictDialog : DialogFragment() {

    private var _binding: NewBoxDialogConflictBinding? = null
    private val binding get() = _binding!!

    private var conflictCount: Int = 0
    private var onResolutionSelected: ((String) -> Unit)? = null

    companion object {
        private const val ARG_CONFLICT_COUNT = "conflict_count"

        fun newInstance(
            conflictCount: Int,
            onResolution: (String) -> Unit
        ): ConflictDialog {
            return ConflictDialog().apply {
                arguments = Bundle().apply {
                    putInt(ARG_CONFLICT_COUNT, conflictCount)
                }
                onResolutionSelected = onResolution
            }
        }
    }

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = NewBoxDialogConflictBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        conflictCount = arguments?.getInt(ARG_CONFLICT_COUNT, 1) ?: 1

        // Set conflict message
        binding.tvConflictMessage.text = getString(R.string.conflict_message, conflictCount)

        // Option clicks with highlight feedback
        binding.optionReplace.setOnClickListener {
            highlightOption(it)
            onResolutionSelected?.invoke("replace")
            dismiss()
        }

        binding.optionExtend.setOnClickListener {
            highlightOption(it)
            onResolutionSelected?.invoke("extend")
            dismiss()
        }

        binding.optionOverlap.setOnClickListener {
            highlightOption(it)
            onResolutionSelected?.invoke("overlap")
            dismiss()
        }

        binding.btnBack.setOnClickListener {
            dismiss()
        }
    }

    override fun onCreateDialog(savedInstanceState: Bundle?): Dialog {
        val dialog = super.onCreateDialog(savedInstanceState)
        dialog.window?.setBackgroundDrawableResource(R.drawable.bg_card_rounded)
        return dialog
    }

    override fun onStart() {
        super.onStart()
        dialog?.window?.setLayout(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        )
    }

    private fun highlightOption(view: View) {
        // Reset all options
        binding.optionReplace.setBackgroundResource(R.drawable.bg_card_rounded)
        binding.optionExtend.setBackgroundResource(R.drawable.bg_card_rounded)
        binding.optionOverlap.setBackgroundResource(R.drawable.bg_card_rounded)
        // Highlight selected
        view.setBackgroundColor(ContextCompat.getColor(requireContext(), R.color.surfaceSelected))
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
