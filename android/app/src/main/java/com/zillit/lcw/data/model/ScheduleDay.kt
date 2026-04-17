package com.zillit.lcw.data.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class ScheduleDay(
    @SerialName("_id") val id: String,
    val projectId: String,
    var title: String = "",
    val typeId: String,
    var typeName: String = "",
    var color: String = "#3498DB",
    val dateRangeType: String = "by_dates",
    var startDate: Long = 0L,
    var endDate: Long = 0L,
    var numberOfDays: Int = 0,
    var calendarDays: List<Long> = emptyList(),
    val timezone: String = "UTC",
    var version: Int = 1,
    val deleted: Long = 0L,
    val createdAt: Long = 0L,
    val updatedAt: Long = 0L,
    // Calendar endpoint includes nested events/notes
    val events: List<ScheduleEvent> = emptyList(),
    val notes: List<ScheduleEvent> = emptyList()
)
