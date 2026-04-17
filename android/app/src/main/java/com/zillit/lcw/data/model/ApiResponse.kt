package com.zillit.lcw.data.model

import kotlinx.serialization.Serializable

@Serializable
data class ApiResponse<T>(
    val status: Int,
    val message: String,
    val messageElements: List<String> = emptyList(),
    val data: T? = null
)
