package com.zillit.lcw.data.repository

import android.content.Context
import android.util.Log
import com.zillit.lcw.data.api.BoxScheduleApi
import com.zillit.lcw.data.model.*
import kotlinx.serialization.json.JsonObject

/**
 * BoxScheduleRepository — single source of truth for Box Schedule data.
 * Wraps BoxScheduleApi with error handling and logging.
 * ViewModels call this instead of the API directly.
 */
class BoxScheduleRepository(context: Context) {

    private val api = BoxScheduleApi(context)
    private val tag = "BoxScheduleRepo"

    // ── Types ──

    suspend fun getTypes(): Result<List<ScheduleType>> = apiCall("getTypes") {
        api.getTypes().data ?: emptyList()
    }

    suspend fun createType(title: String, color: String): Result<ScheduleType> = apiCall("createType") {
        api.createType(title, color).data!!
    }

    suspend fun updateType(id: String, title: String? = null, color: String? = null): Result<ScheduleType> = apiCall("updateType") {
        api.updateType(id, title, color).data!!
    }

    suspend fun deleteType(id: String): Result<Unit> = apiCall("deleteType") {
        api.deleteType(id)
        Unit
    }

    // ── Days ──

    suspend fun getDays(startDate: Long? = null, endDate: Long? = null, typeId: String? = null): Result<List<ScheduleDay>> = apiCall("getDays") {
        api.getDays(startDate, endDate, typeId).data ?: emptyList()
    }

    suspend fun createDay(
        title: String, typeId: String, dateRangeType: String,
        calendarDays: List<Long>, timezone: String = "UTC",
        conflictAction: String = ""
    ): Result<ScheduleDay> = apiCall("createDay") {
        api.createDay(title, typeId, dateRangeType, calendarDays, timezone, conflictAction).data!!
    }

    suspend fun updateDay(id: String, data: JsonObject): Result<ScheduleDay> = apiCall("updateDay") {
        api.updateDay(id, data).data!!
    }

    suspend fun deleteDay(id: String): Result<Unit> = apiCall("deleteDay") {
        api.deleteDay(id)
        Unit
    }

    suspend fun removeDates(entries: List<JsonObject>): Result<JsonObject> = apiCall("removeDates") {
        api.removeDates(entries).data!!
    }

    suspend fun duplicateDay(sourceDayId: String, newStartDate: Long): Result<ScheduleDay> = apiCall("duplicateDay") {
        api.duplicateDay(sourceDayId, newStartDate).data!!
    }

    // ── Events ──

    suspend fun getEvents(
        startDate: Long? = null, endDate: Long? = null,
        scheduleDayId: String? = null, eventType: String? = null
    ): Result<List<ScheduleEvent>> = apiCall("getEvents") {
        api.getEvents(startDate, endDate, scheduleDayId, eventType).data ?: emptyList()
    }

    suspend fun createEvent(data: JsonObject): Result<ScheduleEvent> = apiCall("createEvent") {
        api.createEvent(data).data!!
    }

    suspend fun updateEvent(id: String, data: JsonObject): Result<ScheduleEvent> = apiCall("updateEvent") {
        api.updateEvent(id, data).data!!
    }

    suspend fun deleteEvent(id: String): Result<Unit> = apiCall("deleteEvent") {
        api.deleteEvent(id)
        Unit
    }

    // ── Calendar ──

    suspend fun getCalendar(startDate: Long? = null, endDate: Long? = null): Result<List<ScheduleDay>> = apiCall("getCalendar") {
        api.getCalendar(startDate, endDate).data ?: emptyList()
    }

    // ── Activity Log ──

    suspend fun getActivityLog(
        limit: Int = 50, page: Int = 0,
        startDate: Long? = null, endDate: Long? = null
    ): Result<BoxScheduleApi.ActivityLogResponse> = apiCall("getActivityLog") {
        api.getActivityLog(limit, page, startDate, endDate).data!!
    }

    // ── Revisions ──

    suspend fun getRevisions(): Result<List<Revision>> = apiCall("getRevisions") {
        api.getRevisions().data ?: emptyList()
    }

    suspend fun getCurrentRevision(): Result<Revision> = apiCall("getCurrentRevision") {
        api.getCurrentRevision().data!!
    }

    // ── Share ──

    suspend fun generateShareLink(): Result<BoxScheduleApi.ShareLinkResponse> = apiCall("generateShareLink") {
        api.generateShareLink().data!!
    }

    suspend fun getSharedSchedule(token: String): Result<BoxScheduleApi.SharedScheduleResponse> = apiCall("getSharedSchedule") {
        api.getSharedSchedule(token).data!!
    }

    // ── Error Handling ──

    private suspend fun <T> apiCall(name: String, block: suspend () -> T): Result<T> {
        return try {
            Log.d(tag, "📡 $name → calling...")
            val result = block()
            Log.d(tag, "✅ $name → success")
            Result.success(result)
        } catch (e: Exception) {
            Log.e(tag, "❌ $name → failed: ${e.message}", e)
            Result.failure(e)
        }
    }
}
