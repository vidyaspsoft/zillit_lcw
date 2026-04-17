package com.zillit.lcw.ui.boxschedule.share

import android.app.Dialog
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.fragment.app.DialogFragment
import androidx.lifecycle.ViewModelProvider
import com.zillit.lcw.R
import com.zillit.lcw.databinding.DialogShareBinding
import com.zillit.lcw.ui.boxschedule.BoxScheduleViewModel
import com.zillit.lcw.util.DateUtils
import com.zillit.lcw.util.showToast

/**
 * ShareDialog — DialogFragment with Generate Link + Copy as Text.
 * Wired to API via shared ViewModel.
 * Matches web's ShareScheduleModal.
 */
class ShareDialog : DialogFragment() {

    private var _binding: DialogShareBinding? = null
    private val binding get() = _binding!!

    private lateinit var viewModel: BoxScheduleViewModel
    private var generatedLink: String? = null

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = DialogShareBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        viewModel = ViewModelProvider(requireActivity())[BoxScheduleViewModel::class.java]

        setupShareLink()
        setupCopyText()

        binding.btnClose.setOnClickListener { dismiss() }
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

    private fun setupShareLink() {
        binding.btnGenerateLink.setOnClickListener {
            binding.btnGenerateLink.isEnabled = false
            binding.btnGenerateLink.text = getString(R.string.loading)

            viewModel.generateShareLink { url ->
                if (url != null) {
                    generatedLink = url
                    binding.tvShareLink.text = url
                    binding.btnGenerateLink.visibility = View.GONE
                    binding.linkContainer.visibility = View.VISIBLE
                } else {
                    binding.btnGenerateLink.isEnabled = true
                    binding.btnGenerateLink.text = getString(R.string.share_generate)
                    Toast.makeText(requireContext(), getString(R.string.error_generic), Toast.LENGTH_SHORT).show()
                }
            }
        }

        binding.btnCopyLink.setOnClickListener {
            generatedLink?.let { link ->
                copyToClipboard(link)
                val originalText = binding.btnCopyLink.text
                binding.btnCopyLink.text = getString(R.string.share_copied)
                Handler(Looper.getMainLooper()).postDelayed({
                    if (_binding != null) {
                        binding.btnCopyLink.text = originalText
                    }
                }, 2000)
            }
        }
    }

    private fun setupCopyText() {
        binding.btnCopyText.setOnClickListener {
            // Build schedule text from ViewModel data
            val scheduleDays = viewModel.scheduleDays.value ?: emptyList()

            val scheduleText = buildString {
                appendLine("PRODUCTION SCHEDULE")
                appendLine("==================")
                appendLine()
                if (scheduleDays.isEmpty()) {
                    appendLine("No schedule days yet.")
                } else {
                    for (day in scheduleDays.sortedBy { it.startDate }) {
                        val dateStr = DateUtils.formatDate(day.startDate)
                        val typeName = day.typeName.ifEmpty { getString(R.string.untitled) }
                        val title = day.title.ifEmpty { "" }
                        if (title.isNotEmpty()) {
                            appendLine("$dateStr \u2014 $typeName \u2014 $title")
                        } else {
                            appendLine("$dateStr \u2014 $typeName")
                        }
                    }
                }
            }
            copyToClipboard(scheduleText)

            val originalText = binding.btnCopyText.text
            binding.btnCopyText.text = getString(R.string.share_copied)
            Handler(Looper.getMainLooper()).postDelayed({
                if (_binding != null) {
                    binding.btnCopyText.text = originalText
                }
            }, 2000)
        }
    }

    private fun copyToClipboard(text: String) {
        val clipboard = requireContext().getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        val clip = ClipData.newPlainText(getString(R.string.share_title), text)
        clipboard.setPrimaryClip(clip)
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
