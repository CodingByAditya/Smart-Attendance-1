// =========================================
// Smart Attendance - Central Logic
// =========================================

const $ = (id) => document.getElementById(id);
const API_BASE = window.location.origin;

let stream = null;
let countdownTimer = null;

// student token from QR link: index.html?token=xxxx
const SESSION_TOKEN = new URLSearchParams(window.location.search).get("token");

// Message helper
function showMsg(text, type = "info") {
    const msg = $("msg") || $("sessionStatus");
    if (!msg) return;
    msg.className = `msg ${type}`;
    msg.innerText = text;
}

// =========================================
// Date & Time Management
// =========================================
function updateDateTime() {
    const dateEl = $("date");
    const timeEl = $("time");
    if (!dateEl && !timeEl) return;

    const now = new Date();
    if (dateEl) dateEl.innerText = now.toLocaleDateString("en-IN");
    if (timeEl) timeEl.innerText = now.toLocaleTimeString("en-IN");
}
setInterval(updateDateTime, 1000);
updateDateTime();

// =========================================
// Camera Logic (index.html)
// =========================================
async function startCamera() {
    const video = $("video");
    if (!video) return;
    try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
        video.srcObject = stream;
        showMsg("✅ Camera ON", "success");
    } catch (e) {
        showMsg("❌ Camera Permission Denied", "error");
    }
}

function stopCamera() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
    if ($("video")) $("video").srcObject = null;
    showMsg("⚠️ Camera OFF", "warn");
}

// =========================================
// Mark Attendance (index.html)
// =========================================
async function markAttendance() {
    const name = $("studentName")?.value.trim();
    const regNo = $("registrationNo")?.value.trim();
    const video = $("video");
    const canvas = $("canvas");

    if (!SESSION_TOKEN) return showMsg("❌ Scan Teacher QR first", "error");
    if (!name || !regNo) return showMsg("❌ Enter Name & Reg No", "error");
    if (!stream) return showMsg("❌ Start Camera first", "error");

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    const imageData = canvas.toDataURL("image/png");

    try {
        showMsg("⏳ Saving...", "info");
        const res = await fetch(`${API_BASE}/student/add`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, registrationNo: regNo, image: imageData, token: SESSION_TOKEN })
        });

        if (res.ok) {
            showMsg("✅ Attendance Recorded!", "success");
            $("photo").src = imageData;
            $("photo-container").style.display = "block";
            $("studentName").value = "";
            $("registrationNo").value = "";
        } else {
            showMsg("❌ Failed to save", "error");
        }
    } catch (e) {
        showMsg("❌ Server Error", "error");
    }
}

// =========================================
// Teacher Session (teacher.html)
// =========================================
async function startTeacherSession() {
    try {
        const res = await fetch(`${API_BASE}/session/start`);
        const data = await res.json();
        
        // Use current folder path to generate the student link
        const currentPath = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/'));
        const studentUrl = `${window.location.origin}${currentPath}/index.html?token=${data.token}`;

        $("qrImg").src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(studentUrl)}`;
        $("studentLink").href = studentUrl;
        $("qrBox").style.display = "block";
        
        startCountdown(data.expiresInSeconds || 30);
    } catch (e) {
        showMsg("❌ Could not start session", "error");
    }
}

function startCountdown(seconds) {
    let left = seconds;
    clearInterval(countdownTimer);
    countdownTimer = setInterval(() => {
        left--;
        $("leftSec").innerText = left;
        if (left <= 0) {
            clearInterval(countdownTimer);
            showMsg("⏳ Session Expired", "warn");
            $("qrBox").style.display = "none";
        }
    }, 1000);
}

// =========================================
// Report Generation (report.html)
// =========================================
async function generateReport() {
    const regNo = $("regNoInput")?.value.trim();
    if (!regNo) return showMsg("❌ Enter Registration No", "error");

    try {
        const res = await fetch(`${API_BASE}/student/report/${regNo}`);
        const data = await res.json();
        
        if (data && data.length > 0) {
            $("displayName").innerText = data[0].name;
            const percent = ((data.length / 40) * 100).toFixed(1);
            $("displayCount").innerText = `${data.length} (${percent}%)`;
            $("reportResult").style.display = "block";
            showMsg("✅ Report Loaded", "success");
        } else {
            showMsg("❌ No records found", "warn");
        }
    } catch (e) {
        showMsg("❌ Server Error", "error");
    }
}

// =========================================
// CSV Export (view.html)
// =========================================
function exportTableToCSV(filename) {
    let csv = [];
    const rows = document.querySelectorAll("table tr");
    for (const row of rows) {
        const cols = row.querySelectorAll("td, th");
        const rowData = Array.from(cols).map(c => `"${c.innerText}"`).join(",");
        csv.push(rowData);
    }
    const blob = new Blob([csv.join("\n")], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
}

// Initialize View Page Data
if ($("data")) {
    (async () => {
        try {
            const res = await fetch(`${API_BASE}/students`);
            const list = await res.json();
            const tbody = $("data");
            tbody.innerHTML = list.map(s => `
                <tr>
                    <td><img src="${API_BASE}/photos/${s.photo}" class="student-photo"></td>
                    <td>${s.name}</td>
                    <td>${s.registrationNo}</td>
                    <td>${s.attendanceDate}</td>
                    <td>${s.attendanceTime}</td>
                </tr>
            `).join("");
            showMsg("✅ Data Loaded", "success");
        } catch (e) {
            showMsg("❌ Failed to load data", "error");
        }
    })();
}