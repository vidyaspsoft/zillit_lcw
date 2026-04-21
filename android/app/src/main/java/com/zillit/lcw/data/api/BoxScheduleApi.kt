package com.zillit.lcw.data.api

import android.content.Context
import com.zillit.lcw.data.model.*
import io.ktor.client.*
import io.ktor.client.call.*
import io.ktor.client.request.*
import io.ktor.client.statement.*
import io.ktor.http.*
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.*

/** Thrown when /days returns 409 — UI uses this to decide whether to show the conflict dialog. */
class ScheduleConflictException(
    val conflicts: List<JsonObject>
) : RuntimeException("schedule_day_conflict")

/**
 * BoxScheduleApi — all 21 API endpoints.
 * Uses Ktor HttpClient with JsonBuilder for serialization.
 * All requests auto-include the `moduledata` auth header via KtorClient.
 */
class BoxScheduleApi(private val context: Context) {

    private val client: HttpClient by lazy { KtorClient.create(context) }
    private val baseUrl = KtorClient.BASE_URL

    // ═══════════════════════ SCHEDULE TYPES ═══════════════════════

    /** GET /types — list all schedule types (seeds defaults on first call) */
    suspend fun getTypes(): ApiResponse<List<ScheduleType>> {
        return client.get("$baseUrl/types").body()
    }

    /** POST /types — create a custom type */
    suspend fun createType(title: String, color: String): ApiResponse<ScheduleType> {
        return client.post("$baseUrl/types") {
            setBody(buildJsonObject {
                put("title", title)
                put("color", color)
            })
        }.body()
    }

    /** PUT /types/:id — update type name/color */
    suspend fun updateType(id: String, title: String? = null, color: String? = null): ApiResponse<ScheduleType> {
        return client.put("$baseUrl/types/$id") {
            setBody(buildJsonObject {
                title?.let { put("title", it) }
                color?.let { put("color", it) }
            })
        }.body()
    }

    /** DELETE /types/:id — no body; backend reads userId from moduledata. */
    suspend fun deleteType(id: String): ApiResponse<JsonObject> {
        return client.delete("$baseUrl/types/$id").body()
    }

    // ═══════════════════════ SCHEDULE DAYS ═══════════════════════

    /** GET /days — list schedule days with optional filters */
    suspend fun getDays(startDate: Long? = null, endDate: Long? = null, typeId: String? = null): ApiResponse<List<ScheduleDay>> {
        return client.get("$baseUrl/days") {
            startDate?.let { parameter("startDate", it.toString()) }
            endDate?.let { parameter("endDate", it.toString()) }
            typeId?.let { parameter("typeId", it) }
        }.body()
    }

    /** POST /days — create a schedule day */
    suspend fun createDay(
        title: String, typeId: String, dateRangeType: String,
        calendarDays: List<Long>, timezone: String = "UTC",
        conflictAction: String = ""
    ): ApiResponse<ScheduleDay> {
        val response: HttpResponse = client.post("$baseUrl/days") {
            setBody(buildJsonObject {
                put("title", title)
                put("typeId", typeId)
                put("dateRangeType", dateRangeType)
                put("calendarDays", JsonArray(calendarDays.map { JsonPrimitive(it) }))
                put("startDate", calendarDays.minOrNull() ?: 0L)
                put("endDate", calendarDays.maxOrNull() ?: 0L)
                put("numberOfDays", calendarDays.size)
                put("timezone", timezone)
                put("conflictAction", conflictAction)
            })
        }
        // 409 Conflict: body is {status:0, message:"schedule_day_conflict", data:{conflicts:[...]}}
        if (response.status.value == 409) {
            val raw = Json.parseToJsonElement(response.bodyAsText()).jsonObject
            val conflicts = raw["data"]?.jsonObject?.get("conflicts")?.jsonArray
                ?.mapNotNull { it as? JsonObject }
                ?: emptyList()
            throw ScheduleConflictException(conflicts)
        }
        return response.body()
    }

    /** PUT /days/:id — update a schedule day */
    suspend fun updateDay(id: String, data: JsonObject): ApiResponse<ScheduleDay> {
        val response: HttpResponse = client.put("$baseUrl/days/$id") {
            setBody(buildJsonObject {
                data.forEach { key, value -> put(key, value) }
            })
        }
        if (response.status.value == 409) {
            val raw = Json.parseToJsonElement(response.bodyAsText()).jsonObject
            val conflicts = raw["data"]?.jsonObject?.get("conflicts")?.jsonArray
                ?.mapNotNull { it as? JsonObject }
                ?: emptyList()
            throw ScheduleConflictException(conflicts)
        }
        return response.body()
    }

    /** Atomic single-day type change — PUT /days/:id/single-date. */
    suspend fun updateSingleDay(id: String, date: Long, typeId: String, action: String) {
        client.put("$baseUrl/days/$id/single-date") {
            setBody(buildJsonObject {
                put("date", date)
                put("typeId", typeId)
                put("action", action)
            })
        }.body<ApiResponse<JsonObject>>()
    }

    /** DELETE /days/:id — no body; userId comes from moduledata. */
    suspend fun deleteDay(id: String): ApiResponse<JsonObject> {
        return client.delete("$baseUrl/days/$id").body()
    }

    /** POST /days/bulk — bulk update multiple days */
    suspend fun bulkUpdateDays(updates: List<JsonObject>): ApiResponse<List<ScheduleDay>> {
        return client.post("$baseUrl/days/bulk") {
            setBody(buildJsonObject {
                put("updates", JsonArray(updates))
            })
        }.body()
    }

    /** POST /days/remove-dates — remove specific dates from day blocks */
    suspend fun removeDates(entries: List<JsonObject>): ApiResponse<JsonObject> {
        return client.post("$baseUrl/days/remove-dates") {
            setBody(buildJsonObject {
                put("entries", JsonArray(entries))
            })
        }.body()
    }

    /** POST /days/duplicate */
    suspend fun duplicateDay(sourceDayId: String, newStartDate: Long): ApiResponse<ScheduleDay> {
        return client.post("$baseUrl/days/duplicate") {
            setBody(buildJsonObject {
                put("sourceDayId", sourceDayId)
                put("newStartDate", newStartDate)
            })
        }.body()
    }

    // ═══════════════════════ EVENTS ═══════════════════════

    /** GET /events */
    suspend fun getEvents(
        startDate: Long? = null, endDate: Long? = null,
        scheduleDayId: String? = null, eventType: String? = null
    ): ApiResponse<List<ScheduleEvent>> {
        return client.get("$baseUrl/events") {
            startDate?.let { parameter("startDate", it.toString()) }
            endDate?.let { parameter("endDate", it.toString()) }
            scheduleDayId?.let { parameter("scheduleDayId", it) }
            eventType?.let { parameter("eventType", it) }
        }.body()
    }

    /** POST /events — create event or note */
    suspend fun createEvent(data: JsonObject): ApiResponse<ScheduleEvent> {
        return client.post("$baseUrl/events") {
            setBody(buildJsonObject {
                data.forEach { key, value -> put(key, value) }
            })
        }.body()
    }

    /** PUT /events/:id */
    suspend fun updateEvent(id: String, data: JsonObject): ApiResponse<ScheduleEvent> {
        return client.put("$baseUrl/events/$id") {
            setBody(buildJsonObject {
                data.forEach { key, value -> put(key, value) }
            })
        }.body()
    }

    /** DELETE /events/:id — no body; userId comes from moduledata. */
    suspend fun deleteEvent(id: String): ApiResponse<JsonObject> {
        return client.delete("$baseUrl/events/$id").body()
    }

    // ═══════════════════════ CALENDAR ═══════════════════════

    /** GET /calendar — days with nested events/notes */
    suspend fun getCalendar(startDate: Long? = null, endDate: Long? = null): ApiResponse<List<ScheduleDay>> {
        return client.get("$baseUrl/calendar") {
            startDate?.let { parameter("startDate", it.toString()) }
            endDate?.let { parameter("endDate", it.toString()) }
        }.body()
    }

    // ═══════════════════════ ACTIVITY LOG ═══════════════════════

    /** GET /activity-log */
    @Serializable
    data class ActivityLogResponse(
        val logs: List<ActivityLog>,
        val total: Int,
        val page: Int,
        val limit: Int
    )

    suspend fun getActivityLog(
        limit: Int = 50, page: Int = 0,
        startDate: Long? = null, endDate: Long? = null
    ): ApiResponse<ActivityLogResponse> {
        return client.get("$baseUrl/activity-log") {
            parameter("limit", limit.toString())
            parameter("page", page.toString())
            startDate?.let { parameter("startDate", it.toString()) }
            endDate?.let { parameter("endDate", it.toString()) }
        }.body()
    }

    // ═══════════════════════ REVISIONS ═══════════════════════

    /** GET /revisions */
    suspend fun getRevisions(startDate: Long? = null, endDate: Long? = null): ApiResponse<List<Revision>> {
        return client.get("$baseUrl/revisions") {
            startDate?.let { parameter("startDate", it.toString()) }
            endDate?.let { parameter("endDate", it.toString()) }
        }.body()
    }

    /** GET /revisions/current */
    suspend fun getCurrentRevision(): ApiResponse<Revision> {
        return client.get("$baseUrl/revisions/current").body()
    }

    // ═══════════════════════ SHARE ═══════════════════════

    @Serializable
    data class ShareLinkResponse(val token: String, val shareUrl: String)

    /** POST /share/generate-link */
    suspend fun generateShareLink(): ApiResponse<ShareLinkResponse> {
        return client.post("$baseUrl/share/generate-link").body()
    }

    @Serializable
    data class SharedScheduleResponse(
        val projectId: String,
        val days: List<ScheduleDay>,
        val events: List<ScheduleEvent>,
        val types: List<ScheduleType>
    )

    /** GET /share/:token — public, no auth needed */
    suspend fun getSharedSchedule(token: String): ApiResponse<SharedScheduleResponse> {
        return client.get("$baseUrl/share/$token").body()
    }
}
