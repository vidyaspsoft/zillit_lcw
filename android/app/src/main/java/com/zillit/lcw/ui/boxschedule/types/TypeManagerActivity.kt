package com.zillit.lcw.ui.boxschedule.types

import android.app.AlertDialog
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.EditText
import android.widget.ImageButton
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.activity.viewModels
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.zillit.lcw.R
import com.zillit.lcw.data.model.ScheduleType
import com.zillit.lcw.databinding.NewBoxDialogTypeManagerBinding
import com.zillit.lcw.ui.boxschedule.BoxScheduleViewModel
import com.zillit.lcw.util.toColorInt
import com.skydoves.colorpickerview.ColorPickerDialog
import com.skydoves.colorpickerview.listeners.ColorEnvelopeListener

/**
 * TypeManagerActivity — full-screen page to manage schedule types.
 * Mirrors iOS TypeManagerView: back arrow + title, scrollable list,
 * pinned "Add Custom Type" footer. Custom types get edit + delete actions.
 */
class TypeManagerActivity : AppCompatActivity() {

    private lateinit var binding: NewBoxDialogTypeManagerBinding
    private val viewModel: BoxScheduleViewModel by viewModels()
    private lateinit var typeAdapter: TypeAdapter
    private var selectedColor = "#F39C12"

    private val availableColors = listOf(
        "#F39C12", "#E74C3C", "#27AE60", "#95A5A6", "#3498DB",
        "#8E44AD", "#1ABC9C", "#E67E22", "#2980B9", "#C0392B",
        "#16A085", "#D35400", "#2C3E50", "#7F8C8D"
    )

    private var currentTypes: List<ScheduleType> = emptyList()
    private var typeCountAtCreate: Int = -1

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = NewBoxDialogTypeManagerBinding.inflate(layoutInflater)
        setContentView(binding.root)

        setupTypesList()
        setupAddSection()
        setupActions()
        observeViewModel()

        viewModel.fetchTypes()
    }

    private fun observeViewModel() {
        viewModel.scheduleTypes.observe(this) { types ->
            currentTypes = types
            typeAdapter.submitList(types)
            // Auto-close once the server confirms the newly created type appeared.
            // CreateScheduleActivity.onResume refetches + auto-selects via typeCountBefore.
            if (typeCountAtCreate >= 0 && types.size > typeCountAtCreate) {
                typeCountAtCreate = -1
                binding.root.postDelayed({ finish() }, 150)
            }
        }
        viewModel.errorMessage.observe(this) { message ->
            if (!message.isNullOrEmpty()) {
                binding.tvTypeError.text = message
                binding.tvTypeError.visibility = View.VISIBLE
                // Cancel pending auto-close if create failed
                typeCountAtCreate = -1
            }
        }
    }

    private fun setupTypesList() {
        typeAdapter = TypeAdapter()
        binding.typesList.layoutManager = LinearLayoutManager(this)
        binding.typesList.adapter = typeAdapter
    }

    private fun setupAddSection() {
        updateColorPreview()
        binding.newTypeColor.setOnClickListener { anchor ->
            showColorPalette(anchor, selectedColor) { picked ->
                selectedColor = picked
                updateColorPreview()
            }
        }

        binding.btnAddType.setOnClickListener {
            val name = binding.etNewTypeName.text.toString().trim()
            if (name.isEmpty()) {
                binding.tvTypeError.text = getString(R.string.tm_type_name_hint)
                binding.tvTypeError.visibility = View.VISIBLE
                return@setOnClickListener
            }
            if (currentTypes.any { it.title.equals(name, ignoreCase = true) }) {
                binding.tvTypeError.text = getString(R.string.tm_name_exists)
                binding.tvTypeError.visibility = View.VISIBLE
                return@setOnClickListener
            }
            val existingWithColor = currentTypes.find { it.color.equals(selectedColor, ignoreCase = true) }
            if (existingWithColor != null) {
                binding.tvTypeError.text = getString(R.string.tm_color_used, existingWithColor.title)
                binding.tvTypeError.visibility = View.VISIBLE
                return@setOnClickListener
            }
            binding.tvTypeError.visibility = View.GONE
            typeCountAtCreate = currentTypes.size
            viewModel.createType(name, selectedColor)
            binding.etNewTypeName.text?.clear()
        }
    }

    private fun updateColorPreview() {
        val drawable = GradientDrawable().apply {
            shape = GradientDrawable.OVAL
            setColor(selectedColor.toColorInt())
            setStroke(dpToPx(1), ContextCompat.getColor(this@TypeManagerActivity, R.color.borderInput))
        }
        binding.newTypeColor.backgroundTintList = null
        binding.newTypeColor.background = drawable
    }

    private fun setupActions() {
        binding.btnCloseTypes.setOnClickListener { finish() }
        binding.btnDone.setOnClickListener { finish() }
    }

    /** Edit existing custom type: name + color. */
    fun showEditTypeDialog(type: ScheduleType) {
        var editColor = type.color

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dpToPx(20), dpToPx(16), dpToPx(20), dpToPx(8))
        }
        val row = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }
        val circle = View(this).apply {
            layoutParams = LinearLayout.LayoutParams(dpToPx(28), dpToPx(28)).apply {
                marginEnd = dpToPx(10)
            }
            background = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(editColor.toColorInt())
                setStroke(dpToPx(1), ContextCompat.getColor(this@TypeManagerActivity, R.color.borderInput))
            }
            isClickable = true; isFocusable = true
        }
        val nameInput = EditText(this).apply {
            setText(type.title)
            hint = getString(R.string.tm_type_name_hint)
            textSize = 14f
            setSingleLine(true)
            layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f)
        }
        row.addView(circle); row.addView(nameInput); root.addView(row)

        AlertDialog.Builder(this)
            .setTitle(getString(R.string.action_edit))
            .setView(root)
            .setPositiveButton(getString(R.string.tm_save)) { _, _ ->
                val newName = nameInput.text.toString().trim().ifEmpty { type.title }
                val nameChanged = newName != type.title
                val colorChanged = !editColor.equals(type.color, ignoreCase = true)
                if (nameChanged || colorChanged) {
                    viewModel.updateType(
                        id = type.id,
                        title = if (nameChanged) newName else null,
                        color = if (colorChanged) editColor else null,
                    )
                }
            }
            .setNegativeButton(getString(R.string.action_cancel), null)
            .show()

        circle.setOnClickListener { anchor ->
            showColorPalette(anchor, editColor) { picked ->
                editColor = picked
                (circle.background as? GradientDrawable)?.setColor(picked.toColorInt())
            }
        }
    }

    /** Full HSV color picker dialog (Skydoves library) — with hex input, brightness slider. */
    private fun showColorPalette(
        anchor: View,
        currentColor: String,
        onPick: (String) -> Unit,
    ) {
        val initial = runCatching { currentColor.toColorInt() }.getOrDefault(0xFF9B59B6.toInt())

        ColorPickerDialog.Builder(this)
            .setTitle("Pick a color")
            .setPreferenceName("TypeColorPicker")
            .setPositiveButton(
                "Done",
                ColorEnvelopeListener { envelope, _ ->
                    // envelope.hexCode returns "AARRGGBB" (8 chars, no #). Strip alpha.
                    val rgb = envelope.hexCode.takeLast(6)
                    onPick("#$rgb")
                }
            )
            .setNegativeButton(getString(R.string.action_cancel)) { d, _ -> d.dismiss() }
            .attachAlphaSlideBar(false)
            .attachBrightnessSlideBar(true)
            .setBottomSpace(12)
            .apply {
                colorPickerView.setInitialColor(initial)
            }
            .show()
    }

    private fun dpToPx(dp: Int): Int =
        (dp * resources.displayMetrics.density).toInt()

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

                val dotSize = context.resources.getDimensionPixelSize(R.dimen.legend_dot_size)
                dotView.layoutParams = LinearLayout.LayoutParams(dotSize, dotSize).apply {
                    marginEnd = context.resources.getDimensionPixelSize(R.dimen.spacing_sm)
                }
                container.addView(dotView)

                nameView.layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f)
                nameView.textSize = 14f
                nameView.setTextColor(ContextCompat.getColor(context, R.color.textPrimary))
                container.addView(nameView)

                systemBadge.text = context.getString(R.string.tm_system)
                systemBadge.textSize = 9f
                systemBadge.setTextColor(ContextCompat.getColor(context, R.color.textMuted))
                systemBadge.setBackgroundResource(R.drawable.bg_button_secondary)
                val badgePadH = context.resources.getDimensionPixelSize(R.dimen.spacing_sm)
                val badgePadV = context.resources.getDimensionPixelSize(R.dimen.spacing_xxs)
                systemBadge.setPadding(badgePadH, badgePadV, badgePadH, badgePadV)
                systemBadge.layoutParams = LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.WRAP_CONTENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT
                ).apply {
                    marginEnd = context.resources.getDimensionPixelSize(R.dimen.spacing_sm)
                }
                container.addView(systemBadge)

                btnEdit.layoutParams = LinearLayout.LayoutParams(dpToPx(32), dpToPx(32)).apply {
                    marginEnd = context.resources.getDimensionPixelSize(R.dimen.spacing_xs)
                }
                btnEdit.setImageResource(android.R.drawable.ic_menu_edit)
                btnEdit.setBackgroundResource(android.R.color.transparent)
                btnEdit.setColorFilter(ContextCompat.getColor(context, R.color.textLink))
                container.addView(btnEdit)

                btnDelete.layoutParams = LinearLayout.LayoutParams(dpToPx(32), dpToPx(32))
                btnDelete.setImageResource(android.R.drawable.ic_menu_delete)
                btnDelete.setBackgroundResource(android.R.color.transparent)
                btnDelete.setColorFilter(ContextCompat.getColor(context, R.color.textMuted))
                container.addView(btnDelete)
            }

            fun bind(type: ScheduleType) {
                val context = itemView.context
                val dotDrawable = GradientDrawable().apply {
                    shape = GradientDrawable.OVAL
                    setColor(type.color.toColorInt())
                }
                dotView.background = dotDrawable
                nameView.text = type.title
                systemBadge.visibility = if (type.systemDefined) View.VISIBLE else View.GONE

                if (type.systemDefined) {
                    btnEdit.visibility = View.GONE
                    btnDelete.visibility = View.GONE
                } else {
                    btnEdit.visibility = View.VISIBLE
                    btnDelete.visibility = View.VISIBLE
                    btnEdit.setOnClickListener {
                        this@TypeManagerActivity.showEditTypeDialog(type)
                    }
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
