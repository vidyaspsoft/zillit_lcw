package com.zillit.lcw.util

import java.text.SimpleDateFormat
import java.util.*

/**
 * DateUtils — convert between epoch milliseconds and formatted date strings.
 * All Box Schedule dates are stored as epoch ms (Long).
 */
object DateUtils {

    private val dateFormat = SimpleDateFormat("MMM d, yyyy", Locale.US)
    private val timeFormat = SimpleDateFormat("h:mm a", Locale.US)
    private val dayNameFormat = SimpleDateFormat("EEEE", Locale.US)
    private val monthYearFormat = SimpleDateFormat("MMMM yyyy", Locale.US)
    private val shortDateFormat = SimpleDateFormat("MMM d", Locale.US)
    private val dayMonthFormat = SimpleDateFormat("EEE, MMM d", Locale.US)
    private val fullDayFormat = SimpleDateFormat("EEEE, MMM d, yyyy", Locale.US)

    fun fromEpoch(ms: Long): Date = Date(ms)

    fun toEpoch(date: Date): Long = date.time

    fun formatDate(ms: Long): String = dateFormat.format(Date(ms))

    fun formatTime(ms: Long): String = timeFormat.format(Date(ms))

    fun formatDayName(ms: Long): String = dayNameFormat.format(Date(ms))

    fun formatMonthYear(date: Date): String = monthYearFormat.format(date)

    fun formatShortDate(ms: Long): String = shortDateFormat.format(Date(ms))

    fun formatDayMonth(ms: Long): String = dayMonthFormat.format(Date(ms))

    fun formatFullDay(ms: Long): String = fullDayFormat.format(Date(ms))

    fun startOfDay(date: Date): Date {
        val cal = Calendar.getInstance()
        cal.time = date
        cal.set(Calendar.HOUR_OF_DAY, 0)
        cal.set(Calendar.MINUTE, 0)
        cal.set(Calendar.SECOND, 0)
        cal.set(Calendar.MILLISECOND, 0)
        return cal.time
    }

    fun startOfDayMs(ms: Long): Long = startOfDay(Date(ms)).time

    fun isToday(ms: Long): Boolean {
        val today = startOfDay(Date())
        val target = startOfDay(Date(ms))
        return today.time == target.time
    }

    fun isPast(ms: Long): Boolean {
        return startOfDayMs(ms) < startOfDayMs(System.currentTimeMillis())
    }

    fun isWeekend(ms: Long): Boolean {
        val cal = Calendar.getInstance()
        cal.timeInMillis = ms
        val day = cal.get(Calendar.DAY_OF_WEEK)
        return day == Calendar.SATURDAY || day == Calendar.SUNDAY
    }

    fun addDays(ms: Long, days: Int): Long {
        val cal = Calendar.getInstance()
        cal.timeInMillis = ms
        cal.add(Calendar.DAY_OF_MONTH, days)
        return cal.timeInMillis
    }
}
