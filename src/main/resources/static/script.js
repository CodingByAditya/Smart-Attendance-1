const $ = (id) => document.getElementById(id);
const API_BASE = window.location.origin;

let stream = null;
let countdownTimer = null;

// Helper to show status messages
function showMsg(text, type = "info") {
    const msg = $("msg") || $("sessionStatus");
    if (!msg) return;
    msg.className = `msg ${type}`;
    msg.innerText = text;
}

// ============================
// 1. DATE & TIME (index.html)
// ============================
function updateDateTime() {
    const dateEl = $("date");
    const timeEl = $("time");
    if (!dateEl && !timeEl) return;
    const now = new Date();
    if (dateEl) dateEl.innerText = now.toLocaleDateString("en-IN");
    if (timeEl) timeEl.innerText = now.toLocaleTimeString("en-IN");
}
setInterval(updateDateTime, 1000);

// ============================
// 2. CAMERA CONTROL (index.html)
// ============================
async function startCamera() {
    try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
        $("video").srcObject = stream;
        showMsg("✅ Camera ON", "success");
    } catch (e) {
        showMsg("❌ Camera access denied", "error");
    }
}

function stopCamera() {
    if (stream) stream.getTracks().forEach(t => t.stop());
    if ($("video")) $("video").srcObject = null;
    showMsg("⚠️ Camera OFF", "warn");
}

// ============================
// 3. MARK ATTENDANCE (index.html)
// ============================
async function markAttendance() {
    const token = new URLSearchParams(window.location.search).get("token");
    const name = $("studentName")?.value.trim();
    const regNo = $("registrationNo")?.value.trim();
    
    if (!token) return showMsg("❌ Scan Teacher QR first", "error");
    if (!name || !regNo) return showMsg("❌ Missing Name or Reg No", "error");
    if (!stream) return showMsg("❌ Start Camera first", "error");

    const canvas = $("canvas");
    canvas.width = $("video").videoWidth;
    canvas.height = $("video").videoHeight;
    canvas.getContext("2d").drawImage($("video"), 0, 0);
    const imageData = canvas.toDataURL("image/png");

    try {
        showMsg("⏳ Saving...", "info");
        const res = await fetch(`${API_BASE}/student/add`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, registrationNo: regNo, image: imageData, token })
        });
        if (res.ok) {
            showMsg("✅ Attendance Saved", "success");
            $("studentName").value = ""; $("registrationNo").value = "";
        } else {
            showMsg("❌ Failed to save", "error");
        }
    } catch (e) { showMsg("❌ Server unreachable", "error"); }
}

// ============================
// 4. TEACHER SESSION (teacher.html)
// ============================
async function startTeacherSession() {
    try {
        showMsg("⏳ Creating session...", "info");
        const res = await fetch(`${API_BASE}/session/start`);
        if (!res.ok) throw new Error("Backend error");
        
        const data = await res.json();
        const studentUrl = `${window.location.origin}/index.html?token=${data.token}`;

        $("qrImg").src = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(studentUrl)}`;
        $("studentLink").href = studentUrl;
        $("qrBox").style.display = "block";
        
        startCountdown(data.expiresInSeconds || 30);
    } catch (e) { showMsg("❌ Could not connect to Spring Boot", "error"); }
}

function startCountdown(seconds) {
    let left = seconds;
    clearInterval(countdownTimer);
    countdownTimer = setInterval(() => {
        left--;
        if ($("leftSec")) $("leftSec").innerText = left;
        if (left <= 0) {
            clearInterval(countdownTimer);
            showMsg("⏳ Session Expired", "warn");
            $("qrBox").style.display = "none";
        }
    }, 1000);
}

// ============================
// 5. REPORT GENERATION (report.html)
// ============================
async function generateReport() {
    const regNo = $("regNoInput")?.value.trim();
    if (!regNo) return showMsg("❌ Enter Reg No", "error");

    try {
        const res = await fetch(`${API_BASE}/student/report/${regNo}`);
        const data = await res.json();
        if (data && data.length > 0) {
            $("displayName").innerText = data[0].name;
            $("displayCount").innerText = `${data.length} (${((data.length/40)*100).toFixed(1)}%)`;
            $("reportResult").style.display = "block";
            showMsg("✅ Report loaded", "success");
        } else { showMsg("❌ No records found", "warn"); }
    } catch (e) { showMsg("❌ Server error", "error"); }
}

// ============================
// 6. LOAD FULL LIST (view.html)
// ============================
if ($("data")) {
    (async function() {
        try {
            const res = await fetch(`${API_BASE}/students`);
            const list = await res.json();
            $("data").innerHTML = list.map(s => `
                <tr>
                    <td><img src="${API_BASE}/photos/${s.photo}" class="student-photo"></td>
                    <td>${s.name}</td>
                    <td>${s.registrationNo}</td>
                    <td>${s.attendanceDate}</td>
                    <td>${s.attendanceTime}</td>
                </tr>`).join("");
            showMsg("✅ Data updated", "success");
        } catch (e) { showMsg("❌ Connection failed", "error"); }
    })();
}