package com.zillit.lcw.data.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class ActivityLog(
    @SerialName("_id") val id: String,
    val projectId: String,
    val action: String, // created, updated, deleted, duplicated, shared
    val targetType: String, // schedule_day, schedule_type, event, note
    val targetId: String = "",
    val targetTitle: String = "",
    val details: String = "",
    val performedBy: PerformedBy = PerformedBy(),
    val createdAt: Long = 0L,
    val updatedAt: Long = 0L
)

@Serializable
data class PerformedBy(
    val userId: String = "",
    val name: String = ""
)
