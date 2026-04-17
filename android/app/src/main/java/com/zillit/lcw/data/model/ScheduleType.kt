package com.zillit.lcw.data.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class ScheduleType(
    @SerialName("_id") val id: String,
    val projectId: String,
    var title: String,
    var color: String,
    val systemDefined: Boolean = false,
    var order: Int = 0,
    val createdAt: Long = 0L,
    val updatedAt: Long = 0L
)
