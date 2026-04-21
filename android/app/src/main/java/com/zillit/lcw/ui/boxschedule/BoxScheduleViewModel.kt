package com.zillit.lcw.ui.boxschedule

import android.app.Application
import androidx.lifecycle.*
import com.zillit.lcw.data.model.*
import com.zillit.lcw.data.repository.BoxScheduleRepository
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

/**
 * BoxScheduleViewModel — manages all Box Schedule state.
 * Connected to real API via BoxScheduleRepository.
 * Uses AndroidViewModel for Application context (needed by Ktor client).
 */
class BoxScheduleViewModel(application: Application) : AndroidViewModel(application) {

    private val repository = BoxScheduleRepository(application.applicationContext)

    // ── Observable State ──

    private val _scheduleTypes = MutableLiveData<List<ScheduleType>>(emptyList())
    val scheduleTypes: LiveData<List<ScheduleType>> = _scheduleTypes

    private val _scheduleDays = MutableLiveData<List<ScheduleDay>>(emptyList())
    val scheduleDays: LiveData<List<ScheduleDay>> = _scheduleDays

    private val _calendarData = MutableLiveData<List<ScheduleDay>>(emptyList())
    val calendarData: LiveData<List<ScheduleDay>> = _calendarData

    private val _activityLogs = MutableLiveData<List<ActivityLog>>(emptyList())
    val activityLogs: LiveData<List<ActivityLog>> = _activityLogs

    private val _revisions = MutableLiveData<List<Revision>>(emptyList())
    val revisions: LiveData<List<Revision>> = _revisions

    private val _isLoading = MutableLiveData(false)
    val isLoading: LiveData<Boolean> = _isLoading

    private val _errorMessage = MutableLiveData<String?>()
    val errorMessage: LiveData<String?> = _errorMessage
    fun clearErrorMessage() { _errorMessage.value = null }

    private val _calendarMode = MutableLiveData("month")
    val calendarMode: LiveData<String> = _calendarMode

    private val _activeView = MutableLiveData("calendar")
    val activeView: LiveData<String> = _activeView

    // ── Shared filters (List + Calendar views both consume these) ──
    private val _filterSearchText = MutableLiveData("")
    val filterSearchText: LiveData<String> = _filterSearchText
    fun setFilterSearchText(v: String) { _filterSearchText.value = v }

    private val _filterTypeName = MutableLiveData("") // "" = All Types
    val filterTypeName: LiveData<String> = _filterTypeName
    fun setFilterTypeName(v: String) { _filterTypeName.value = v }

    private val _filterContentKind = MutableLiveData("all") // "all" | "schedules" | "events" | "notes"
    val filterContentKind: LiveData<String> = _filterContentKind
    fun setFilterContentKind(v: String) { _filterContentKind.value = v }

    // ── Load All Data ──

    fun loadAll() {
        viewModelScope.launch {
            _isLoading.value = true
            _errorMessage.value = null

            val typesResult = repository.getTypes()
            val daysResult = repository.getDays()
            val calendarResult = repository.getCalendar()

            typesResult.onSuccess { _scheduleTypes.value = it }
            daysResult.onSuccess { _scheduleDays.value = it }
            calendarResult.onSuccess { _calendarData.value = it }

            typesResult.onFailure { _errorMessage.value = it.message }
            _isLoading.value = false
        }
    }

    // ── Types ──

    fun fetchTypes() {
        viewModelScope.launch {
            repository.getTypes().onSuccess { _scheduleTypes.value = it }
        }
    }

    fun createType(title: String, color: String) {
        viewModelScope.launch {
            repository.createType(title, color)
                .onSuccess { fetchTypes() }
                .onFailure { _errorMessage.value = it.message }
        }
    }

    fun updateType(id: String, title: String? = null, color: String? = null) {
        viewModelScope.launch {
            repository.updateType(id, title, color)
                .onSuccess { fetchTypes() }
                .onFailure { _errorMessage.value = it.message }
        }
    }

    fun deleteType(id: String) {
        viewModelScope.launch {
            repository.deleteType(id)
                .onSuccess { fetchTypes() }
                .onFailure { _errorMessage.value = it.message }
        }
    }

    // ── Days ──

    fun fetchDays() {
        viewModelScope.launch {
            repository.getDays().onSuccess { _scheduleDays.value = it }
        }
    }

    // One-shot success signal for save screens (null = idle, true = success, false = failed)
    private val _scheduleSaved = MutableLiveData<Boolean?>()
    val scheduleSaved: LiveData<Boolean?> = _scheduleSaved
    fun clearScheduleSaved() { _scheduleSaved.value = null }

    // Dedicated 409 conflict signal — carries the conflicts array from the response body.
    // UI observes this instead of string-matching the error message.
    private val _conflictDetected = MutableLiveData<List<kotlinx.serialization.json.JsonObject>?>()
    val conflictDetected: LiveData<List<kotlinx.serialization.json.JsonObject>?> = _conflictDetected
    fun clearConflictDetected() { _conflictDetected.value = null }

    fun createDay(
        title: String, typeId: String, dateRangeType: String,
        calendarDays: List<Long>, conflictAction: String = ""
    ) {
        viewModelScope.launch {
            repository.createDay(title, typeId, dateRangeType, calendarDays, "UTC", conflictAction)
                .onSuccess {
                    _scheduleSaved.value = true
                    refreshAll()
                }
                .onFailure { err ->
                    // HTTP 409 → surface conflicts on the dedicated signal (no message-string matching)
                    if (err is com.zillit.lcw.data.api.ScheduleConflictException) {
                        _conflictDetected.value = err.conflicts
                    } else {
                        _errorMessage.value = err.message
                    }
                    _scheduleSaved.value = false
                }
        }
    }

    fun deleteDay(id: String) {
        viewModelScope.launch {
            repository.deleteDay(id)
                .onSuccess { refreshAll() }
                .onFailure { _errorMessage.value = it.message }
        }
    }

    /**
     * Atomic single-day edit (PUT /days/:id/single-date).
     * Backend handles the split: mutates source block + creates new 1-day block in one transaction.
     */
    fun executeSingleDayEdit(
        oldDayId: String,
        singleDate: Long,
        originalTypeId: String,
        newTypeId: String,
        action: String    // "replace" | "extend" | "overlap"
    ) {
        viewModelScope.launch {
            // Same type → nothing material to change.
            if (originalTypeId == newTypeId) {
                _scheduleSaved.value = true
                refreshAll()
                return@launch
            }
            repository.updateSingleDay(oldDayId, singleDate, newTypeId, action)
                .onSuccess {
                    _scheduleSaved.value = true
                    refreshAll()
                }
                .onFailure { err ->
                    _errorMessage.value = err.message
                    _scheduleSaved.value = false
                }
        }
    }

    /** Update an existing schedule day (web parity: PUT /days/:id). */
    fun updateDay(
        id: String, typeId: String, dateRangeType: String,
        calendarDays: List<Long>, title: String = "",
        conflictAction: String = ""
    ) {
        viewModelScope.launch {
            val data = kotlinx.serialization.json.buildJsonObject {
                put("title", kotlinx.serialization.json.JsonPrimitive(title))
                put("typeId", kotlinx.serialization.json.JsonPrimitive(typeId))
                put("dateRangeType", kotlinx.serialization.json.JsonPrimitive(dateRangeType))
                put("calendarDays", kotlinx.serialization.json.JsonArray(
                    calendarDays.map { kotlinx.serialization.json.JsonPrimitive(it) }
                ))
                put("startDate", kotlinx.serialization.json.JsonPrimitive(calendarDays.minOrNull() ?: 0L))
                put("endDate", kotlinx.serialization.json.JsonPrimitive(calendarDays.maxOrNull() ?: 0L))
                put("numberOfDays", kotlinx.serialization.json.JsonPrimitive(calendarDays.size))
                if (conflictAction.isNotEmpty()) {
                    put("conflictAction", kotlinx.serialization.json.JsonPrimitive(conflictAction))
                }
            }
            repository.updateDay(id, data)
                .onSuccess {
                    _scheduleSaved.value = true
                    refreshAll()
                }
                .onFailure { err ->
                    if (err is com.zillit.lcw.data.api.ScheduleConflictException) {
                        _conflictDetected.value = err.conflicts
                    } else {
                        _errorMessage.value = err.message
                    }
                    _scheduleSaved.value = false
                }
        }
    }

    /** Remove specific calendar dates from one or more schedule days (web /days/remove-dates). */
    fun removeDates(entries: List<Pair<String, List<Long>>>) {
        viewModelScope.launch {
            val jsonEntries = entries.map { (id, dates) ->
                kotlinx.serialization.json.buildJsonObject {
                    put("id", kotlinx.serialization.json.JsonPrimitive(id))
                    put("dates", kotlinx.serialization.json.JsonArray(dates.map { kotlinx.serialization.json.JsonPrimitive(it) }))
                }
            }
            repository.removeDates(jsonEntries)
                .onSuccess { refreshAll() }
                .onFailure { _errorMessage.value = it.message }
        }
    }

    fun duplicateDay(sourceDayId: String, newStartDate: Long) {
        viewModelScope.launch {
            repository.duplicateDay(sourceDayId, newStartDate)
                .onSuccess { refreshAll() }
                .onFailure { _errorMessage.value = it.message }
        }
    }

    // ── Events ──

    fun createEvent(data: JsonObject) {
        viewModelScope.launch {
            repository.createEvent(data)
                .onSuccess { refreshAll() }
                .onFailure { _errorMessage.value = it.message }
        }
    }

    /** Update an existing event/note (PUT /events/:id). */
    fun updateEvent(id: String, data: JsonObject) {
        viewModelScope.launch {
            repository.updateEvent(id, data)
                .onSuccess { refreshAll() }
                .onFailure { _errorMessage.value = it.message }
        }
    }

    fun deleteEvent(id: String) {
        viewModelScope.launch {
            repository.deleteEvent(id)
                .onSuccess { refreshAll() }
                .onFailure { _errorMessage.value = it.message }
        }
    }

    // ── Calendar ──

    fun fetchCalendar() {
        viewModelScope.launch {
            repository.getCalendar().onSuccess { _calendarData.value = it }
        }
    }

    // ── Activity Log ──

    fun fetchActivityLog(startDate: Long? = null, endDate: Long? = null) {
        viewModelScope.launch {
            repository.getActivityLog(startDate = startDate, endDate = endDate)
                .onSuccess { _activityLogs.value = it.logs }
        }
    }

    // ── Revisions ──

    fun fetchRevisions() {
        viewModelScope.launch {
            repository.getRevisions().onSuccess { _revisions.value = it }
        }
    }

    // ── Share ──

    fun generateShareLink(callback: (String?) -> Unit) {
        viewModelScope.launch {
            repository.generateShareLink()
                .onSuccess { callback(it.shareUrl) }
                .onFailure { _errorMessage.value = it.message; callback(null) }
        }
    }

    // ── Navigation ──

    fun setCalendarMode(mode: String) { _calendarMode.value = mode }
    fun setActiveView(view: String) { _activeView.value = view }

    // ── Refresh ──

    fun refreshAll() {
        viewModelScope.launch {
            val daysResult = repository.getDays()
            val calendarResult = repository.getCalendar()
            daysResult.onSuccess { _scheduleDays.value = it }
            calendarResult.onSuccess { _calendarData.value = it }
        }
    }
}
