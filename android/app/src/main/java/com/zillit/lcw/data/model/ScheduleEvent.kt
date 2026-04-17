package com.zillit.lcw.data.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class ScheduleEvent(
    @SerialName("_id") val id: String,
    val projectId: String = "",
    val scheduleDayId: String? = null,
    val date: Long = 0L,
    val eventType: String = "note", // "event" or "note"
    var title: String = "",
    var color: String = "#3498DB",
    var description: String = "",
    var startDateTime: Long = 0L,
    var endDateTime: Long = 0L,
    var fullDay: Boolean = false,
    var location: String = "",
    var locationLat: Double? = null,
    var locationLng: Double? = null,
    var reminder: String = "none",
    var repeatStatus: String = "none",
    var repeatEndDate: Long = 0L,
    var timezone: String = "",
    var callType: String = "",
    var textColor: String = "",
    var notes: String = "",
    val deleted: Long = 0L,
    val createdAt: Long = 0L,
    val updatedAt: Long = 0L
)
