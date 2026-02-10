/* ============================================================
   Project Parliament - フロントエンドJS
   WebSocket通信、UI操作、ファイルアップロードを管理
   ============================================================ */

// --- WebSocket接続 ---
const socket = io();
let selectedFiles = [];

// ============================================================
// WebSocket イベントリスナー
// ============================================================

socket.on("connect", () => {
    console.log("✅ WebSocket接続完了");
});

socket.on("disconnect", () => {
    console.log("❌ WebSocket切断");
});

// AIステータス更新
socket.on("ai_status_update", (data) => {
    if (data.all_status) {
        Object.entries(data.all_status).forEach(([aiId, status]) => {
            updateAIStatus(aiId, status);
        });
        updateOnlineCount(data.all_status);
        checkAllOnline(data.all_status);
    }
});

// 新しいメッセージ受信
socket.on("new_message", (msg) => {
    appendMessage(msg);
});

// セッションリセット
socket.on("session_reset", (data) => {
    location.reload();
});

// 稟議書更新
socket.on("proposal_update", (data) => {
    updateProposalPanel(data);
});

// 最終稟議書完成
socket.on("final_report_ready", (data) => {
    enableDownload();
});

// ============================================================
// AI起動
// ============================================================

async function activateAllAI() {
    const btn = document.getElementById("btnActivateAll");
    btn.disabled = true;
    btn.textContent = "⏳ 起動中...";

    const aiIds = ["chatgpt", "gemini", "codex", "claude"];

    for (const aiId of aiIds) {
        // ステータスを「接続中」に
        const dot = document.getElementById(`status-${aiId}`);
        dot.className = "status-dot connecting";

        try {
            const res = await fetch("/api/ai/activate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ai_id: aiId }),
            });
            const result = await res.json();

            if (result.success) {
                updateAIStatus(aiId, true);
            }
        } catch (err) {
            console.error(`${aiId} 起動失敗:`, err);
            dot.className = "status-dot offline";
        }

        // 少し待ってから次のAIを起動（演出）
        await sleep(500);
    }

    btn.textContent = "✅ 全AI起動済み";
    document.getElementById("btnStop").disabled = false;
}

// 個別AI起動（クリックで）
async function activateSingleAI(aiId) {
    const dot = document.getElementById(`status-${aiId}`);
    dot.className = "status-dot connecting";

    try {
        const res = await fetch("/api/ai/activate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ai_id: aiId }),
        });
        const result = await res.json();
        if (result.success) {
            updateAIStatus(aiId, true);
        }
    } catch (err) {
        console.error(`${aiId} 起動失敗:`, err);
        dot.className = "status-dot offline";
    }
}

// ============================================================
// 画像アップロード
// ============================================================

function handleFileSelect(event) {
    const files = Array.from(event.target.files);
    addFiles(files);
}

function addFiles(files) {
    const remaining = 5 - selectedFiles.length;
    const toAdd = files.slice(0, remaining);

    toAdd.forEach((file) => {
        if (file.type.startsWith("image/")) {
            selectedFiles.push(file);
        }
    });

    renderPreviews();
    updateStartButton();
}

function removeFile(index) {
    selectedFiles.splice(index, 1);
    renderPreviews();
    updateStartButton();
}

function renderPreviews() {
    const row = document.getElementById("imagePreviewRow");
    row.innerHTML = "";

    selectedFiles.forEach((file, i) => {
        const thumb = document.createElement("div");
        thumb.className = "preview-thumb";

        const img = document.createElement("img");
        img.src = URL.createObjectURL(file);

        const removeBtn = document.createElement("button");
        removeBtn.className = "preview-remove";
        removeBtn.textContent = "✕";
        removeBtn.onclick = () => removeFile(i);

        thumb.appendChild(img);
        thumb.appendChild(removeBtn);
        row.appendChild(thumb);
    });
}

function updateStartButton() {
    const btn = document.getElementById("btnStartDiscussion");
    const allOnline = Object.values(getAIStatuses()).every((s) => s);
    btn.disabled = !(selectedFiles.length > 0 && allOnline);
}

// ドラッグ＆ドロップ対応
const uploadZone = document.getElementById("uploadZone");
if (uploadZone) {
    uploadZone.addEventListener("dragover", (e) => {
        e.preventDefault();
        uploadZone.classList.add("dragover");
    });

    uploadZone.addEventListener("dragleave", () => {
        uploadZone.classList.remove("dragover");
    });

    uploadZone.addEventListener("drop", (e) => {
        e.preventDefault();
        uploadZone.classList.remove("dragover");
        const files = Array.from(e.dataTransfer.files);
        addFiles(files);
    });
}

// ============================================================
// 議論の開始・停止
// ============================================================

async function startDiscussion() {
    if (selectedFiles.length === 0) return;

    const btn = document.getElementById("btnStartDiscussion");
    btn.disabled = true;
    btn.textContent = "⏳ 開始中...";

    const formData = new FormData();
    selectedFiles.forEach((file) => {
        formData.append("charts", file);
    });

    try {
        const res = await fetch("/api/discussion/start", {
            method: "POST",
            body: formData,
        });
        const result = await res.json();

        if (result.success) {
            // UIを議論モードに切り替え
            document.getElementById("uploadPanel").style.display = "none";
            document.getElementById("reportPanel").style.display = "block";
            document.getElementById("chatSubtitle").textContent = "🔴 議論進行中";
        } else {
            alert(result.error || "議論の開始に失敗しました");
            btn.disabled = false;
            btn.textContent = "🚀 議論を開始する";
        }
    } catch (err) {
        console.error("議論開始エラー:", err);
        btn.disabled = false;
        btn.textContent = "🚀 議論を開始する";
    }
}

async function stopDiscussion() {
    if (!confirm("議論を終了し、全てのデータを破棄しますか？")) return;

    try {
        await fetch("/api/discussion/stop", { method: "POST" });
    } catch (err) {
        console.error("停止エラー:", err);
        location.reload();
    }
}

async function downloadReport() {
    window.location.href = "/api/report/download";
}

// ============================================================
// UI更新ヘルパー関数
// ============================================================

function updateAIStatus(aiId, isOnline) {
    const dot = document.getElementById(`status-${aiId}`);
    if (dot) {
        dot.className = `status-dot ${isOnline ? "online" : "offline"}`;
    }
}

function updateOnlineCount(allStatus) {
    const count = Object.values(allStatus).filter(Boolean).length;
    const el = document.getElementById("onlineCount");
    if (el) {
        el.textContent = `${count}/4 オンライン`;
    }
}

function checkAllOnline(allStatus) {
    const allOnline = Object.values(allStatus).every(Boolean);
    if (allOnline) {
        document.getElementById("chatSubtitle").textContent =
            "全AI準備完了 - チャート画像をアップロードしてください";
    }
    updateStartButton();
}

function getAIStatuses() {
    const statuses = {};
    ["chatgpt", "gemini", "codex", "claude"].forEach((id) => {
        const dot = document.getElementById(`status-${id}`);
        statuses[id] = dot && dot.classList.contains("online");
    });
    return statuses;
}

// AIプロフィール情報（テンプレートから取得できない場合のフォールバック）
const AI_PROFILES = {
    chatgpt: { name: "ChatGPT", icon: "🤖", color: "#10a37f" },
    gemini:  { name: "Gemini",  icon: "💎", color: "#4285f4" },
    codex:   { name: "Codex",   icon: "⚡", color: "#f97316" },
    claude:  { name: "Claude",  icon: "🧠", color: "#d97706" },
};

function appendMessage(msg) {
    const container = document.getElementById("chatMessages");

    const div = document.createElement("div");

    if (msg.type === "system") {
        div.className = "message system-message";
        div.innerHTML = `<div class="message-content"><p>${msg.content}</p></div>`;
    } else if (msg.sender === "user") {
        div.className = "message user-message";
        div.innerHTML = `
            <div class="msg-body">
                <div class="msg-text">${escapeHtml(msg.content)}</div>
                <div class="msg-time">${formatTime(msg.timestamp)}</div>
            </div>`;
    } else if (msg.type === "proposal") {
        const profile = AI_PROFILES[msg.sender] || { name: msg.sender, icon: "🤖", color: "#666" };
        div.className = "message ai-message proposal-message";
        div.innerHTML = `
            <div class="msg-avatar" style="background-color: ${profile.color}">${profile.icon}</div>
            <div class="msg-body">
                <div class="msg-sender">${profile.name}</div>
                <div class="msg-text">
                    <span class="proposal-tag">📋 稟議書</span>
                    <div>${escapeHtml(msg.content)}</div>
                </div>
                <div class="msg-time">${formatTime(msg.timestamp)}</div>
            </div>`;
    } else {
        // AI通常メッセージ
        const profile = AI_PROFILES[msg.sender] || { name: msg.sender, icon: "🤖", color: "#666" };
        div.className = "message ai-message";
        div.innerHTML = `
            <div class="msg-avatar" style="background-color: ${profile.color}">${profile.icon}</div>
            <div class="msg-body">
                <div class="msg-sender">${profile.name}</div>
                <div class="msg-text">${escapeHtml(msg.content)}</div>
                <div class="msg-time">${formatTime(msg.timestamp)}</div>
            </div>`;
    }

    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function updateProposalPanel(data) {
    const statusEl = document.getElementById("proposalStatus");
    const contentEl = document.getElementById("proposalContent");
    const voteEl = document.getElementById("voteDisplay");

    if (data.status === "voting") {
        statusEl.textContent = "投票中";
        statusEl.className = "proposal-status voting";
    } else if (data.status === "approved") {
        statusEl.textContent = "満場一致で承認";
        statusEl.className = "proposal-status approved";
    }

    if (data.content) {
        contentEl.innerHTML = `<div style="font-size:13px; line-height:1.8;">${escapeHtml(data.content)}</div>`;
    }

    if (data.votes) {
        voteEl.innerHTML = Object.entries(data.votes)
            .map(([aiId, vote]) => {
                const profile = AI_PROFILES[aiId] || { name: aiId, icon: "🤖" };
                const badge = vote === "support"
                    ? `<span class="vote-badge support">✅ 賛成</span>`
                    : `<span class="vote-badge oppose">❌ 反対</span>`;
                return `<div class="vote-item">
                    <span class="voter-name">${profile.icon} ${profile.name}</span>
                    ${badge}
                </div>`;
            })
            .join("");
    }
}

function enableDownload() {
    const btn = document.getElementById("btnDownload");
    btn.disabled = false;
    document.getElementById("chatSubtitle").textContent = "✅ 最終稟議書が完成しました";
}

// ============================================================
// ユーティリティ
// ============================================================

function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML.replace(/\n/g, "<br>");
}

function formatTime(isoString) {
    const d = new Date(isoString);
    return d.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================
// 初期化
// ============================================================
document.addEventListener("DOMContentLoaded", () => {
    // 個別AIクリックで起動
    document.querySelectorAll(".ai-member").forEach((el) => {
        el.addEventListener("click", () => {
            const aiId = el.dataset.aiId;
            const dot = document.getElementById(`status-${aiId}`);
            if (!dot.classList.contains("online")) {
                activateSingleAI(aiId);
            }
        });
    });

    console.log("🏛️ Project Parliament - 初期化完了");
});
