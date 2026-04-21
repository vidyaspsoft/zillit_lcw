package com.zillit.lcw.ui.common

import android.content.Context
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.drawable.GradientDrawable
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.LinearLayout
import android.widget.PopupWindow
import android.widget.TextView
import androidx.core.content.ContextCompat
import com.zillit.lcw.R

/**
 * Popup anchored below the "Set as Default" button.
 * Mirrors iOS SetDefaultPopover (260dp, rounded card, radio options with "Current" badge).
 *
 * Use:
 *   SetDefaultPopup.show(
 *     anchor = binding.btnSetDefault,
 *     title = "Choose default mode",
 *     subtitle = "Loads first when you open Calendar.",
 *     options = listOf(
 *       SetDefaultPopup.Option("month", "Month View", "Full month grid"),
 *       SetDefaultPopup.Option("week", "Week View", "One week at a time"),
 *       SetDefaultPopup.Option("day", "Day View", "Single day focused"),
 *     ),
 *     currentValue = "month",
 *     onSelect = { value -> /* save pref + update UI */ },
 *   )
 */
object SetDefaultPopup {

    data class Option(val value: String, val label: String, val description: String)

    fun show(
        anchor: View,
        title: String,
        subtitle: String,
        options: List<Option>,
        currentValue: String,
        onSelect: (String) -> Unit,
    ) {
        val context = anchor.context
        val widthPx = dp(context, 260)
        val padPx = dp(context, 14)
        val gapPx = dp(context, 8)

        val container = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            background = ContextCompat.getDrawable(context, R.drawable.bg_popup_card)
            setPadding(padPx, padPx, padPx, padPx)
            layoutParams = ViewGroup.LayoutParams(widthPx, ViewGroup.LayoutParams.WRAP_CONTENT)
        }

        // Title
        container.addView(TextView(context).apply {
            text = title
            textSize = 14f
            setTextColor(ContextCompat.getColor(context, R.color.textPrimary))
            typeface = android.graphics.Typeface.DEFAULT_BOLD
        })

        // Subtitle
        container.addView(TextView(context).apply {
            text = subtitle
            textSize = 11f
            setTextColor(ContextCompat.getColor(context, R.color.textMuted))
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT,
            ).apply { topMargin = dp(context, 2); bottomMargin = dp(context, 4) }
        })

        // Popup window (created up here so option clicks can dismiss it)
        val popup = PopupWindow(
            container,
            ViewGroup.LayoutParams.WRAP_CONTENT,
            ViewGroup.LayoutParams.WRAP_CONTENT,
            true, // focusable
        ).apply {
            elevation = dp(context, 8).toFloat()
            isOutsideTouchable = true
            setBackgroundDrawable(android.graphics.drawable.ColorDrawable(0))
        }

        // Options
        options.forEach { option ->
            val isCurrent = option.value == currentValue
            val row = buildOptionRow(context, option, isCurrent) {
                onSelect(option.value)
                popup.dismiss()
            }
            row.layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT,
            ).apply { topMargin = gapPx }
            container.addView(row)
        }

        // Anchor below button, right-aligned to it
        popup.showAsDropDown(anchor, 0, dp(context, 4), Gravity.END)
    }

    private fun buildOptionRow(
        context: Context,
        option: Option,
        isCurrent: Boolean,
        onTap: () -> Unit,
    ): LinearLayout {
        val rowPad = dp(context, 10)

        val row = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            background = ContextCompat.getDrawable(context, R.drawable.bg_popup_option)
            isSelected = isCurrent
            setPadding(rowPad, rowPad, rowPad, rowPad)
            isClickable = true
            isFocusable = true
            setOnClickListener { onTap() }
        }

        // Radio circle
        val radio = RadioCircleView(context, isCurrent).apply {
            layoutParams = LinearLayout.LayoutParams(dp(context, 18), dp(context, 18)).apply {
                marginEnd = dp(context, 10)
            }
        }
        row.addView(radio)

        // Label + description column
        val textCol = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f)
        }
        textCol.addView(TextView(context).apply {
            text = option.label
            textSize = 13f
            setTextColor(ContextCompat.getColor(context, R.color.textPrimary))
            typeface = android.graphics.Typeface.create("sans-serif-medium", android.graphics.Typeface.NORMAL)
        })
        textCol.addView(TextView(context).apply {
            text = option.description
            textSize = 10f
            setTextColor(ContextCompat.getColor(context, R.color.textSubtle))
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT,
            ).apply { topMargin = dp(context, 1) }
        })
        row.addView(textCol)

        // "Current" badge if selected
        if (isCurrent) {
            row.addView(TextView(context).apply {
                text = context.getString(R.string.dv_current)
                textSize = 10f
                setTextColor(ContextCompat.getColor(context, R.color.successText))
                typeface = android.graphics.Typeface.create("sans-serif-medium", android.graphics.Typeface.NORMAL)
                layoutParams = LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.WRAP_CONTENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT,
                ).apply { marginStart = dp(context, 8) }
            })
        }

        return row
    }

    private fun dp(context: Context, value: Int): Int =
        (value * context.resources.displayMetrics.density).toInt()

    /** Custom hollow/solid radio circle to match iOS exactly. */
    private class RadioCircleView(context: Context, private val selected: Boolean) : View(context) {
        private val ringPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.STROKE
            color = ContextCompat.getColor(
                context,
                if (selected) R.color.solidDark else R.color.textDisabled,
            )
            strokeWidth = dp(if (selected) 5f else 2f)
        }
        private val innerPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.FILL
            color = ContextCompat.getColor(context, R.color.surface)
        }

        override fun onDraw(canvas: Canvas) {
            super.onDraw(canvas)
            val cx = width / 2f
            val cy = height / 2f
            val outerR = (minOf(width, height) - ringPaint.strokeWidth) / 2f
            canvas.drawCircle(cx, cy, outerR, ringPaint)
            if (selected) {
                canvas.drawCircle(cx, cy, dp(4f), innerPaint)
            }
        }

        private fun dp(value: Float): Float =
            value * resources.displayMetrics.density
    }
}
