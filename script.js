// 근무 기록 저장소
let workRecords = JSON.parse(localStorage.getItem('workRecords')) || [];

// 실시간 업데이트 인터벌
let realTimeInterval = null;

// 수동으로 제외시간을 수정했는지 추적
let isBreakTimeManuallyEdited = false;

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', function() {
    updateCurrentDate();
    renderHistory();
    
    // 실시간 업데이트 시작 (1초마다)
    startRealTimeUpdate();
});

// 현재 날짜 표시 (서울 기준)
function updateCurrentDate() {
    const today = new Date();
    document.getElementById('currentDate').textContent = today.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long',
        timeZone: 'Asia/Seoul'
    });
}

// 실시간 업데이트 시작
function startRealTimeUpdate() {
    if (realTimeInterval) {
        clearInterval(realTimeInterval);
    }
    
    realTimeInterval = setInterval(function() {
        updateRealTimeSummary();
    }, 1000);
}

// 시간 형식 자동 포맷팅 (0900 → 09:00)
function formatTime(input) {
    let value = input.value.replace(/[^0-9]/g, '');
    
    if (value.length >= 2) {
        let hours = value.substring(0, 2);
        let minutes = value.length > 2 ? value.substring(2, 4) : '';
        
        if (parseInt(hours) > 23) {
            hours = '23';
        }
        
        if (minutes.length === 2 && parseInt(minutes) > 59) {
            minutes = '59';
        }
        
        if (value.length >= 2) {
            value = hours + ':' + (minutes || '');
        }
    }
    
    input.value = value;
    
    // 제외시간 필드인 경우 수동 수정 플래그 설정 및 실시간 계산
    if (input.id === 'breakTime') {
        isBreakTimeManuallyEdited = true;
        updateWorkTimeWithBreakTime();
    }
}

// 시간 문자열을 분으로 변환 (HH:MM 형식)
function timeToMinutes(timeStr) {
    if (!timeStr || timeStr.length < 5) return 0;
    const parts = timeStr.split(':');
    if (parts.length !== 2) return 0;
    const hours = parseInt(parts[0]) || 0;
    const minutes = parseInt(parts[1]) || 0;
    return hours * 60 + minutes;
}

// "X시간 Y분" 형식의 문자열을 분으로 변환
function workTimeStringToMinutes(timeStr) {
    if (!timeStr) return 0;
    
    let totalMinutes = 0;
    
    // 시간 추출 (예: "8시간" -> 8)
    const hoursMatch = timeStr.match(/(\d+)시간/);
    if (hoursMatch) {
        totalMinutes += parseInt(hoursMatch[1]) * 60;
    }
    
    // 분 추출 (예: "57분" -> 57)
    const minsMatch = timeStr.match(/(\d+)분/);
    if (minsMatch) {
        totalMinutes += parseInt(minsMatch[1]);
    }
    
    return totalMinutes;
}

// 분을 시간 문자열로 변환 (HH:MM 형식)
function minutesToTimeString(minutes) {
    if (minutes < 0) {
        const absMinutes = Math.abs(minutes);
        const hours = Math.floor(absMinutes / 60);
        const mins = absMinutes % 60;
        return `-${hours}시간 ${mins}분`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}시간 ${mins}분`;
}

// 초과근무시간 계산 (8시간 기준) - "X시간 Y분" 형식으로 반환
function calculateOvertime(workMinutes) {
    const standardMinutes = 8 * 60; // 8시간 = 480분
    const diff = workMinutes - standardMinutes;
    
    if (diff === 0) {
        return '0분';
    }
    
    const hours = Math.floor(Math.abs(diff) / 60);
    const mins = Math.abs(diff) % 60;
    
    let result = '';
    if (diff > 0) {
        result = '+';
    } else {
        result = '-';
    }
    
    if (hours > 0 && mins > 0) {
        result += `${hours}시간 ${mins}분`;
    } else if (hours > 0) {
        result += `${hours}시간`;
    } else {
        result += `${mins}분`;
    }
    
    return result;
}

// 분을 HH:MM 형식으로 변환
function minutesToHHMM(minutes) {
    if (minutes < 0) minutes = 0;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return String(hours).padStart(2, '0') + ':' + String(mins).padStart(2, '0');
}

// 휴게시간 자동 계산 (기준에 따라)
function calculateBreakTime(workMinutes) {
    if (workMinutes >= 8 * 60) {
        return 60; // 8시간 이상: 1시간
    } else if (workMinutes >= 4 * 60) {
        return 30; // 4시간 이상: 30분
    }
    return 0; // 4시간 미만: 0분
}

// 제외시간 수동 변경 시 호출
function onBreakTimeChange() {
    isBreakTimeManuallyEdited = true;
    updateWorkTimeWithBreakTime();
    updateRealTimeSummary();
}

// 제외시간 변경 시 1일 근무시간 실시간 업데이트
function updateWorkTimeWithBreakTime() {
    const startTime = document.getElementById('startTime').value;
    const endTime = document.getElementById('endTime').value;
    const breakTimeInput = document.getElementById('breakTime').value;
    
    if (!startTime || !endTime || startTime.length < 5 || endTime.length < 5) {
        return;
    }
    
    const startMinutes = timeToMinutes(startTime);
    const endMinutes = timeToMinutes(endTime);
    
    // 총 근무시간 계산
    let totalMinutes = endMinutes - startMinutes;
    
    // 익일 근무 고려
    if (totalMinutes < 0) {
        totalMinutes += 24 * 60;
    }
    
    // 제외시간을 분으로 변환 (HH:MM 형식)
    let breakMinutes = 0;
    if (breakTimeInput && breakTimeInput.length >= 5) {
        breakMinutes = timeToMinutes(breakTimeInput);
    }
    
    // 실제 근무시간 계산
    const actualWorkMinutes = totalMinutes - breakMinutes;
    
    // 결과 표시
    document.getElementById('workTime').value = minutesToTimeString(actualWorkMinutes);
}

// 실시간 근무시간 요약 업데이트
function updateRealTimeSummary() {
    const startTime = document.getElementById('startTime').value;
    const endTime = document.getElementById('endTime').value;
    const breakTimeInput = document.getElementById('breakTime').value;
    
    if (!startTime || startTime.length < 5) {
        document.getElementById('totalWorkTime').textContent = '0시간 0분';
        document.getElementById('totalBreakTime').textContent = '0시간 0분';
        document.getElementById('actualWorkTime').textContent = '0시간 0분';
        document.getElementById('overtime').textContent = '0분';
        return;
    }
    
    // 현재 시간 (서울 기준)
    const now = new Date();
    const currentHours = now.getHours();
    const currentMinutes = now.getMinutes();
    const currentTotalMinutes = currentHours * 60 + currentMinutes;
    
    // 출근시간을 분으로 변환
    const startMinutes = timeToMinutes(startTime);
    
    // 총 근무시간 (출근시간부터 현재까지)
    let totalWorkMinutes = currentTotalMinutes - startMinutes;
    
    // 익일 근무 고려
    if (totalWorkMinutes < 0) {
        totalWorkMinutes += 24 * 60;
    }
    
    // 휴게시간 계산
    let breakMinutes = 0;
    
    // 수동으로 제외시간이 수정된 경우: 자동 계산 완전히 금지, 입력된 값만 사용
    if (isBreakTimeManuallyEdited) {
        // 사용자가 입력 중일 수 있으므로 값이 있으면 사용, 없으면 0
        if (breakTimeInput && breakTimeInput.length >= 5) {
            breakMinutes = timeToMinutes(breakTimeInput);
        }
        // 수동 수정 모드에서는 제외시간 필드를 자동으로 변경하지 않음
    } else if (endTime && endTime.length >= 5) {
        // 퇴근 예정 시간이 있는 경우: 자동 계산
        const endMinutes = timeToMinutes(endTime);
        let scheduledWorkMinutes = endMinutes - startMinutes;
        if (scheduledWorkMinutes < 0) {
            scheduledWorkMinutes += 24 * 60;
        }
        breakMinutes = calculateBreakTime(scheduledWorkMinutes);
        // 제외시간 필드 업데이트 (수동 수정이 아닌 경우에만)
        document.getElementById('breakTime').value = minutesToHHMM(breakMinutes);
    } else {
        // 퇴근 예정 시간이 없는 경우: 현재 근무시간 기준으로 자동 계산
        breakMinutes = calculateBreakTime(totalWorkMinutes);
    }
    
    // 실제 근무시간 (총 근무시간 - 휴게시간)
    const actualWorkMinutes = totalWorkMinutes - breakMinutes;
    
    // 결과 표시
    document.getElementById('totalWorkTime').textContent = minutesToTimeString(totalWorkMinutes);
    document.getElementById('totalBreakTime').textContent = minutesToTimeString(breakMinutes);
    document.getElementById('actualWorkTime').textContent = minutesToTimeString(actualWorkMinutes);
    
    // 초과근무시간 표시 - "1일 근무시간" 필드(workTime)의 값을 기준으로 계산
    const workTimeInput = document.getElementById('workTime').value;
    const workTimeMinutes = workTimeStringToMinutes(workTimeInput);
    document.getElementById('overtime').textContent = calculateOvertime(workTimeMinutes);
}

// 근무시간 계산 (퇴근 예정 시간 기준)
function calculateWorkTime() {
    const startTime = document.getElementById('startTime').value;
    const endTime = document.getElementById('endTime').value;
    
    // 출근시간, 퇴근시간 변경 시 수동 수정 플래그 리셋
    isBreakTimeManuallyEdited = false;
    
    if (!startTime || !endTime || startTime.length < 5 || endTime.length < 5) {
        document.getElementById('breakTime').value = '';
        document.getElementById('workTime').value = '';
        updateRealTimeSummary();
        return;
    }
    
    const startMinutes = timeToMinutes(startTime);
    const endMinutes = timeToMinutes(endTime);
    
    // 총 근무시간 계산
    let totalMinutes = endMinutes - startMinutes;
    
    // 익일 근무 고려
    if (totalMinutes < 0) {
        totalMinutes += 24 * 60;
    }
    
    // 휴게시간 자동 계산
    const breakMinutes = calculateBreakTime(totalMinutes);
    
    // 실제 근무시간 계산
    const actualWorkMinutes = totalMinutes - breakMinutes;
    
    // 결과 표시 (제외시간은 HH:MM 형식으로)
    document.getElementById('breakTime').value = minutesToHHMM(breakMinutes);
    document.getElementById('workTime').value = minutesToTimeString(actualWorkMinutes);
    
    // 실시간 요약 업데이트
    updateRealTimeSummary();
}

// 기록 저장
function saveRecord() {
    const startTime = document.getElementById('startTime').value;
    const endTime = document.getElementById('endTime').value;
    const breakTime = document.getElementById('breakTime').value;
    const workTime = document.getElementById('workTime').value;
    
    if (!startTime || !endTime || startTime.length < 5 || endTime.length < 5) {
        alert('출근시간과 퇴근 예정 시간을 모두 올바르게 입력해주세요. (예: 09:00)');
        return;
    }
    
    const today = new Date();
    const record = {
        id: Date.now(),
        date: today.toLocaleDateString('ko-KR'),
        startTime: startTime,
        endTime: endTime,
        breakTime: breakTime ? minutesToTimeString(timeToMinutes(breakTime)) : '0시간 0분',
        workTime: workTime
    };
    
    workRecords.push(record);
    localStorage.setItem('workRecords', JSON.stringify(workRecords));
    
    renderHistory();
    clearInputs();
    
    alert('기록이 저장되었습니다!');
}

// 기록 삭제
function deleteRecord(id) {
    if (confirm('이 기록을 삭제하시겠습니까?')) {
        workRecords = workRecords.filter(record => record.id !== id);
        localStorage.setItem('workRecords', JSON.stringify(workRecords));
        renderHistory();
    }
}

// 입력 초기화
function clearInputs() {
    document.getElementById('startTime').value = '';
    document.getElementById('endTime').value = '';
    document.getElementById('breakTime').value = '';
    document.getElementById('workTime').value = '';
    
    document.getElementById('totalWorkTime').textContent = '0시간 0분';
    document.getElementById('totalBreakTime').textContent = '0시간 0분';
    document.getElementById('actualWorkTime').textContent = '0시간 0분';
    document.getElementById('overtime').textContent = '0분';
    
    // 수동 수정 플래그 리셋
    isBreakTimeManuallyEdited = false;
}

// 기록 테이블 렌더링
function renderHistory() {
    const tbody = document.getElementById('workHistory');
    
    if (workRecords.length === 0) {
        tbody.innerHTML = `
            <tr class="empty-row">
                <td colspan="6">근무 기록이 없습니다. 위에서 시간을 입력하고 저장해주세요.</td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = workRecords.map(record => `
        <tr>
            <td>${record.date}</td>
            <td>${record.startTime}</td>
            <td>${record.endTime}</td>
            <td>${record.breakTime}</td>
            <td><strong>${record.workTime}</strong></td>
            <td>
                <button class="btn btn-delete" onclick="deleteRecord(${record.id})">🗑️ 삭제</button>
            </td>
        </tr>
    `).join('');
}