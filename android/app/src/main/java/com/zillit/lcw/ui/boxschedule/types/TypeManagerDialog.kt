package com.zillit.lcw.ui.boxschedule.types

import android.app.AlertDialog
import android.app.Dialog
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.view.Gravity
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.EditText
import android.widget.ImageButton
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.core.content.ContextCompat
import androidx.fragment.app.DialogFragment
import androidx.lifecycle.ViewModelProvider
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.zillit.lcw.R
import com.zillit.lcw.data.model.ScheduleType
import com.zillit.lcw.databinding.DialogTypeManagerBinding
import com.zillit.lcw.ui.boxschedule.BoxScheduleViewModel
import com.zillit.lcw.util.showToast
import com.zillit.lcw.util.toColorInt

/**
 * TypeManagerDialog — DialogFragment for managing schedule types.
 * Scrollable list of types + add custom type section.
 * Wired to API via shared BoxScheduleViewModel.
 * Matches web's ScheduleTypeManager.
 */
class TypeManagerDialog : DialogFragment() {

    private var _binding: DialogTypeManagerBinding? = null
    private val binding get() = _binding!!

    private lateinit var viewModel: BoxScheduleViewModel
    private lateinit var typeAdapter: TypeAdapter
    private var selectedColor = "#F39C12"

    // Available colors for custom types
    private val availableColors = listOf(
        "#F39C12", "#E74C3C", "#27AE60", "#95A5A6", "#3498DB",
        "#8E44AD", "#1ABC9C", "#E67E22", "#2980B9", "#C0392B",
        "#16A085", "#D35400", "#2C3E50", "#7F8C8D"
    )

    // Current types from API
    private var currentTypes: List<ScheduleType> = emptyList()

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = DialogTypeManagerBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        viewModel = ViewModelProvider(requireActivity())[BoxScheduleViewModel::class.java]

        setupTypesList()
        setupAddSection()
        setupActions()
        observeViewModel()

        // Load types from API
        viewModel.fetchTypes()
    }

    private fun observeViewModel() {
        viewModel.scheduleTypes.observe(viewLifecycleOwner) { types ->
            currentTypes = types
            typeAdapter.submitList(types)
        }

        viewModel.errorMessage.observe(viewLifecycleOwner) { message ->
            if (!message.isNullOrEmpty()) {
                binding.tvTypeError.text = message
                binding.tvTypeError.visibility = View.VISIBLE
            }
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

    private fun setupTypesList() {
        typeAdapter = TypeAdapter()
        binding.typesList.layoutManager = LinearLayoutManager(requireContext())
        binding.typesList.adapter = typeAdapter
    }

    private fun setupAddSection() {
        // Color picker circle click — cycle through colors
        updateColorPreview()
        binding.newTypeColor.setOnClickListener {
            val currentIndex = availableColors.indexOf(selectedColor)
            val nextIndex = (currentIndex + 1) % availableColors.size
            selectedColor = availableColors[nextIndex]
            updateColorPreview()
        }

        // Add button — call API
        binding.btnAddType.setOnClickListener {
            val name = binding.etNewTypeName.text.toString().trim()
            if (name.isEmpty()) {
                binding.tvTypeError.text = getString(R.string.tm_type_name_hint)
                binding.tvTypeError.visibility = View.VISIBLE
                return@setOnClickListener
            }

            // Check duplicate name locally
            if (currentTypes.any { it.title.equals(name, ignoreCase = true) }) {
                binding.tvTypeError.text = getString(R.string.tm_name_exists)
                binding.tvTypeError.visibility = View.VISIBLE
                return@setOnClickListener
            }

            // Check duplicate color locally
            val existingWithColor = currentTypes.find { it.color.equals(selectedColor, ignoreCase = true) }
            if (existingWithColor != null) {
                binding.tvTypeError.text = getString(R.string.tm_color_used, existingWithColor.title)
                binding.tvTypeError.visibility = View.VISIBLE
                return@setOnClickListener
            }

            binding.tvTypeError.visibility = View.GONE

            // Call API to create type
            viewModel.createType(name, selectedColor)
            binding.etNewTypeName.text?.clear()
        }
    }

    private fun updateColorPreview() {
        val drawable = GradientDrawable().apply {
            shape = GradientDrawable.OVAL
            setColor(selectedColor.toColorInt())
        }
        binding.newTypeColor.background = drawable
    }

    private fun setupActions() {
        binding.btnCloseTypes.setOnClickListener { dismiss() }
        binding.btnDone.setOnClickListener { dismiss() }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }

    // ── Inner Adapter ──

    inner class TypeAdapter : RecyclerView.Adapter<TypeAdapter.TypeViewHolder>() {

        private var items = listOf<ScheduleType>()

        fun submitList(newItems: List<ScheduleType>) {
            items = newItems
            notifyDataSetChanged()
        }

        inner class TypeViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
            private val container = itemView as LinearLayout
            private val dotView: View = View(itemView.context)
            private val nameView: TextView = TextView(itemView.context)
            private val systemBadge: TextView = TextView(itemView.context)
            private val btnEdit: ImageButton = ImageButton(itemView.context)
            private val btnDelete: ImageButton = ImageButton(itemView.context)

            init {
                val context = itemView.context
                container.orientation = LinearLayout.HORIZONTAL
                container.gravity = Gravity.CENTER_VERTICAL
                val padH = context.resources.getDimensionPixelSize(R.dimen.spacing_base)
                val padV = context.resources.getDimensionPixelSize(R.dimen.spacing_md)
                container.setPadding(padH, padV, padH, padV)

                // Dot
                val dotSize = context.resources.getDimensionPixelSize(R.dimen.legend_dot_size)
                dotView.layoutParams = LinearLayout.LayoutParams(dotSize, dotSize).apply {
                    marginEnd = context.resources.getDimensionPixelSize(R.dimen.spacing_sm)
                }
                container.addView(dotView)

                // Name
                nameView.layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f)
                nameView.textSize = 14f
                nameView.setTextColor(ContextCompat.getColor(context, R.color.textPrimary))
                container.addView(nameView)

                // System badge
                systemBadge.text = context.getString(R.string.tm_system)
                systemBadge.textSize = 9f
                systemBadge.setTextColor(ContextCompat.getColor(context, R.color.textMuted))
                systemBadge.setBackgroundResource(R.drawable.bg_button_secondary)
                val badgePadH = context.resources.getDimensionPixelSize(R.dimen.spacing_sm)
                val badgePadV = context.resources.getDimensionPixelSize(R.dimen.spacing_xxs)
                systemBadge.setPadding(badgePadH, badgePadV, badgePadH, badgePadV)
                val badgeParams = LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.WRAP_CONTENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT
                ).apply {
                    marginEnd = context.resources.getDimensionPixelSize(R.dimen.spacing_sm)
                }
                systemBadge.layoutParams = badgeParams
                container.addView(systemBadge)

                // Edit button
                btnEdit.layoutParams = LinearLayout.LayoutParams(
                    dpToPx(32), dpToPx(32)
                ).apply {
                    marginEnd = context.resources.getDimensionPixelSize(R.dimen.spacing_xs)
                }
                btnEdit.setImageResource(android.R.drawable.ic_menu_edit)
                btnEdit.setBackgroundResource(android.R.color.transparent)
                container.addView(btnEdit)

                // Delete button
                btnDelete.layoutParams = LinearLayout.LayoutParams(dpToPx(32), dpToPx(32))
                btnDelete.setImageResource(android.R.drawable.ic_menu_delete)
                btnDelete.setBackgroundResource(android.R.color.transparent)
                container.addView(btnDelete)
            }

            fun bind(type: ScheduleType) {
                val context = itemView.context

                // Color dot
                val dotDrawable = GradientDrawable().apply {
                    shape = GradientDrawable.OVAL
                    setColor(type.color.toColorInt())
                }
                dotView.background = dotDrawable

                // Name
                nameView.text = type.title

                // System badge
                systemBadge.visibility = if (type.systemDefined) View.VISIBLE else View.GONE

                // Edit/Delete buttons — only for custom types
                if (type.systemDefined) {
                    btnEdit.visibility = View.GONE
                    btnDelete.visibility = View.GONE
                } else {
                    btnEdit.visibility = View.VISIBLE
                    btnDelete.visibility = View.VISIBLE

                    // Edit: show inline edit dialog
                    btnEdit.setOnClickListener {
                        showEditDialog(type)
                    }

                    // Delete: confirm dialog, then call API
                    btnDelete.setOnClickListener {
                        AlertDialog.Builder(context)
                            .setTitle(context.getString(R.string.delete_confirm_title))
                            .setMessage(context.getString(R.string.delete_confirm_message))
                            .setPositiveButton(context.getString(R.string.action_delete)) { _, _ ->
                                viewModel.deleteType(type.id)
                            }
                            .setNegativeButton(context.getString(R.string.action_cancel), null)
                            .show()
                    }
                }
            }

            private fun showEditDialog(type: ScheduleType) {
                val context = itemView.context
                val editText = EditText(context).apply {
                    setText(type.title)
                    hint = context.getString(R.string.tm_type_name_hint)
                    setPadding(48, 32, 48, 32)
                }

                AlertDialog.Builder(context)
                    .setTitle(context.getString(R.string.action_edit))
                    .setView(editText)
                    .setPositiveButton(context.getString(R.string.tm_save)) { _, _ ->
                        val newName = editText.text.toString().trim()
                        if (newName.isNotEmpty() && newName != type.title) {
                            viewModel.updateType(type.id, title = newName)
                        }
                    }
                    .setNegativeButton(context.getString(R.string.action_cancel), null)
                    .show()
            }

            private fun dpToPx(dp: Int): Int =
                (dp * itemView.resources.displayMetrics.density).toInt()
        }

        override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): TypeViewHolder {
            val container = LinearLayout(parent.context).apply {
                layoutParams = RecyclerView.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT
                )
            }
            return TypeViewHolder(container)
        }

        override fun onBindViewHolder(holder: TypeViewHolder, position: Int) {
            holder.bind(items[position])
        }

        override fun getItemCount(): Int = items.size
    }
}
