package com.zillit.lcw.data.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Auth API response models — used by LoginActivity for project + user fetching.
 * Top-level classes are required for kotlinx.serialization to generate
 * `.serializer()` methods reliably.
 */

@Serializable
data class ProjectItem(
    @SerialName("_id") val id: String,
    val name: String
)

@Serializable
data class UserItem(
    @SerialName("_id") val id: String,
    val name: String,
    val role: String = "member",
    val projectId: String = ""
)

@Serializable
data class ApiListResponse<T>(
    val status: Int,
    val message: String = "",
    val data: List<T>? = null
)
