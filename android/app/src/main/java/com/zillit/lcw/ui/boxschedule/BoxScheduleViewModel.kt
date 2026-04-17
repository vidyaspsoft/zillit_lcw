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

    private val _calendarMode = MutableLiveData("month")
    val calendarMode: LiveData<String> = _calendarMode

    private val _activeView = MutableLiveData("calendar")
    val activeView: LiveData<String> = _activeView

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

    fun createDay(
        title: String, typeId: String, dateRangeType: String,
        calendarDays: List<Long>, conflictAction: String = ""
    ) {
        viewModelScope.launch {
            repository.createDay(title, typeId, dateRangeType, calendarDays, "UTC", conflictAction)
                .onSuccess { refreshAll() }
                .onFailure { _errorMessage.value = it.message }
        }
    }

    fun deleteDay(id: String) {
        viewModelScope.launch {
            repository.deleteDay(id)
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

    fun fetchActivityLog() {
        viewModelScope.launch {
            repository.getActivityLog()
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
