package com.zillit.lcw.data.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class Revision(
    @SerialName("_id") val id: String,
    val projectId: String,
    val revisionNumber: Int,
    val revisionColor: String = "White",
    val typeColor: String = "",
    val description: String = "",
    val changedBy: PerformedBy = PerformedBy(),
    val createdAt: Long = 0L,
    val updatedAt: Long = 0L
)
