/* ============================================================
   Project Parliament - フロントエンド JS v2
   UIフェーズ管理、チャット描画、WebSocket通信
   ============================================================ */

// ===== WebSocket =====
const socket = io();
let selectedFiles = [];

// AIプロフィール（テンプレートから取れない場合のフォールバック）
const AI = {
    chatgpt: { name: "ChatGPT", icon: "🤖", color: "#10a37f" },
    gemini:  { name: "Gemini",  icon: "💎", color: "#4285f4" },
    codex:   { name: "Codex",   icon: "⚡", color: "#f97316" },
    claude:  { name: "Claude",  icon: "🧠", color: "#d97706" },
};

// ステータスラベル
const STATUS_MAP = {
    waiting:    "AI起動待ち",
    standby:    "AI待機中",
    discussing: "議論中",
    voting:     "投票中",
    reviewing:  "稟議審査中",
    complete:   "稟議書提出済み",
};

// ============================================================
// 初期化
// ============================================================
document.addEventListener("DOMContentLoaded", () => {
    // 日付表示
    const now = new Date();
    const dateStr = now.toLocaleDateString("ja-JP", {
        year: "numeric", month: "long", day: "numeric", weekday: "long",
    });
    document.getElementById("headerDate").textContent = dateStr;
    document.getElementById("chatDateLabel").textContent = dateStr;

    // サイドバーのAIスロットクリックで個別起動
    document.querySelectorAll(".ai-slot[data-ai-id]").forEach(el => {
        el.addEventListener("click", () => {
            const id = el.dataset.aiId;
            const ind = document.getElementById(`indicator-${id}`);
            if (!ind.classList.contains("online")) {
                activateSingleAI(id);
            }
        });
    });

    // ドラッグ&ドロップ（チャットエリアにも対応）
    const chatArea = document.getElementById("chatArea");
    chatArea.addEventListener("dragover", e => { e.preventDefault(); });
    chatArea.addEventListener("drop", e => {
        e.preventDefault();
        addFiles(Array.from(e.dataTransfer.files));
    });

    console.log("🏛️ Project Parliament v2 - 初期化完了");
});

// ============================================================
// WebSocket イベント
// ============================================================
socket.on("connect", () => console.log("✅ WS connected"));
socket.on("disconnect", () => console.log("❌ WS disconnected"));

socket.on("ai_status_update", data => {
    if (data.all_status) {
        Object.entries(data.all_status).forEach(([id, on]) => setIndicator(id, on));
        updateOnlineCount(data.all_status);
        checkAllOnline(data.all_status);
    }
});

socket.on("new_message", msg => renderMessage(msg));
socket.on("session_reset", () => location.reload());

socket.on("typing", data => {
    const who = AI[data.ai_id]?.name || data.ai_id;
    const el = document.getElementById("typingWho");
    if (el) el.textContent = `${who} が入力中...`;
});

socket.on("proposal_update", data => updateRightPanel(data));

socket.on("final_report_ready", () => {
    switchPhase("phaseComplete");
    setStatus("complete");
});

// ============================================================
// ステータス管理
// ============================================================
function setStatus(key) {
    const chip = document.getElementById("statusChip");
    chip.dataset.status = key;
    document.getElementById("statusText").textContent = STATUS_MAP[key] || key;
}

function setIndicator(aiId, online) {
    const ind = document.getElementById(`indicator-${aiId}`);
    if (ind) ind.className = `status-indicator ${online ? "online" : "offline"}`;
}

function updateOnlineCount(all) {
    const n = Object.values(all).filter(Boolean).length;
    document.getElementById("onlineBadge").innerHTML =
        `<span class="online-dot${n === 4 ? ' active' : ''}"></span> ${n} / 4`;
}

function checkAllOnline(all) {
    if (Object.values(all).every(Boolean)) {
        setStatus("standby");
        switchPhase("phaseUpload");
    }
    updateStartBtn();
}

// ============================================================
// フェーズ切り替え
// ============================================================
function switchPhase(activeId) {
    ["phaseActivate", "phaseUpload", "phaseRunning", "phaseComplete"].forEach(id => {
        document.getElementById(id).style.display = id === activeId ? "flex" : "none";
    });
}

// ============================================================
// AI起動
// ============================================================
async function activateAllAI() {
    const btn = document.getElementById("btnActivateAll");
    btn.disabled = true;
    btn.innerHTML = '<span class="cb-icon">⏳</span> 起動中...';

    for (const id of ["chatgpt", "gemini", "codex", "claude"]) {
        setIndicatorConnecting(id);
        try {
            const res = await fetch("/api/ai/activate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ai_id: id }),
            });
            const r = await res.json();
            if (r.success) setIndicator(id, true);
        } catch (e) {
            console.error(`${id} fail`, e);
            setIndicator(id, false);
        }
        await sleep(400);
    }
    btn.innerHTML = '<span class="cb-icon">✅</span> 起動完了';
}

async function activateSingleAI(id) {
    setIndicatorConnecting(id);
    try {
        const res = await fetch("/api/ai/activate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ai_id: id }),
        });
        const r = await res.json();
        if (r.success) setIndicator(id, true);
    } catch (e) {
        setIndicator(id, false);
    }
}

function setIndicatorConnecting(id) {
    const ind = document.getElementById(`indicator-${id}`);
    if (ind) ind.className = "status-indicator connecting";
}

// ============================================================
// 画像アップロード
// ============================================================
function handleFileSelect(e) {
    addFiles(Array.from(e.target.files));
    e.target.value = "";
}

function addFiles(files) {
    const remain = 5 - selectedFiles.length;
    files.slice(0, remain).forEach(f => {
        if (f.type.startsWith("image/")) selectedFiles.push(f);
    });
    renderThumbs();
    updateStartBtn();
}

function removeFile(i) {
    selectedFiles.splice(i, 1);
    renderThumbs();
    updateStartBtn();
}

function renderThumbs() {
    const strip = document.getElementById("previewStrip");
    strip.innerHTML = "";
    selectedFiles.forEach((f, i) => {
        const wrap = document.createElement("div");
        wrap.className = "thumb-wrap";
        const img = document.createElement("img");
        img.src = URL.createObjectURL(f);
        const rm = document.createElement("button");
        rm.className = "thumb-remove";
        rm.textContent = "✕";
        rm.onclick = () => removeFile(i);
        wrap.append(img, rm);
        strip.appendChild(wrap);
    });

    const cnt = document.getElementById("fileCount");
    if (selectedFiles.length > 0) {
        cnt.style.display = "flex";
        cnt.textContent = selectedFiles.length;
    } else {
        cnt.style.display = "none";
    }
}

function updateStartBtn() {
    const btn = document.getElementById("btnStart");
    if (!btn) return;
    btn.disabled = selectedFiles.length === 0;
}

// ============================================================
// 議論の開始・停止
// ============================================================
async function startDiscussion() {
    if (selectedFiles.length === 0) return;

    const btn = document.getElementById("btnStart");
    btn.disabled = true;
    btn.innerHTML = '<span class="cb-icon">⏳</span> 開始中...';

    const fd = new FormData();
    selectedFiles.forEach(f => fd.append("charts", f));

    try {
        const res = await fetch("/api/discussion/start", { method: "POST", body: fd });
        const r = await res.json();
        if (r.success) {
            setStatus("discussing");
            switchPhase("phaseRunning");
        } else {
            alert(r.error || "開始に失敗しました");
            btn.disabled = false;
            btn.innerHTML = '<span class="cb-icon">🚀</span> 議論を開始';
        }
    } catch (e) {
        console.error(e);
        btn.disabled = false;
        btn.innerHTML = '<span class="cb-icon">🚀</span> 議論を開始';
    }
}

async function stopDiscussion() {
    if (!confirm("議論を終了し、全データを破棄しますか？")) return;
    try { await fetch("/api/discussion/stop", { method: "POST" }); }
    catch (e) { location.reload(); }
}

function downloadReport() {
    window.location.href = "/api/report/download";
}

// ============================================================
// チャット描画
// ============================================================
function renderMessage(msg) {
    const area = document.getElementById("chatArea");

    if (msg.type === "system") {
        const div = document.createElement("div");
        div.className = "system-bubble";
        div.innerHTML = `<div class="system-inner">
            <span class="sys-icon">📢</span>
            <span class="sys-text">${msg.content}</span>
        </div>`;
        area.appendChild(div);

    } else if (msg.sender === "user") {
        const div = document.createElement("div");
        div.className = "msg-row user";
        div.innerHTML = `
            <div class="msg-avatar" style="background:#3b82f6">👤</div>
            <div class="msg-body">
                <div class="msg-header">
                    <span class="msg-name">あなた</span>
                    <span class="msg-time">${fmtTime(msg.timestamp)}</span>
                </div>
                <div class="msg-bubble">${esc(msg.content)}</div>
            </div>`;
        area.appendChild(div);

    } else if (msg.type === "proposal") {
        const p = AI[msg.sender] || { name: msg.sender, icon: "🤖", color: "#666" };
        const div = document.createElement("div");
        div.className = "msg-row ai";
        div.innerHTML = `
            <div class="msg-avatar" style="background:${p.color}">${p.icon}</div>
            <div class="msg-body">
                <div class="msg-header">
                    <span class="msg-name">${p.name}</span>
                    <span class="msg-time">${fmtTime(msg.timestamp)}</span>
                </div>
                <div class="msg-bubble proposal-bubble">
                    <span class="proposal-tag">📋 稟議書</span>
                    <div>${esc(msg.content)}</div>
                </div>
            </div>`;
        area.appendChild(div);
        setStatus("voting");

    } else {
        // AI通常メッセージ
        const p = AI[msg.sender] || { name: msg.sender, icon: "🤖", color: "#666" };
        const div = document.createElement("div");
        div.className = "msg-row ai";
        div.innerHTML = `
            <div class="msg-avatar" style="background:${p.color}">${p.icon}</div>
            <div class="msg-body">
                <div class="msg-header">
                    <span class="msg-name">${p.name}</span>
                    <span class="msg-time">${fmtTime(msg.timestamp)}</span>
                </div>
                <div class="msg-bubble">${esc(msg.content)}</div>
            </div>`;
        area.appendChild(div);
    }

    // 自動スクロール
    area.scrollTop = area.scrollHeight;
}

// ============================================================
// 右パネル（稟議書・投票）
// ============================================================
function updateRightPanel(data) {
    const badge = document.getElementById("rpanelBadge");
    const body = document.getElementById("rpanelBody");

    // バッジ更新
    if (data.status === "voting") {
        badge.textContent = "投票中";
        badge.className = "rpanel-badge voting";
        setStatus("voting");
    } else if (data.status === "approved") {
        badge.textContent = "承認済み";
        badge.className = "rpanel-badge approved";
        setStatus("reviewing");
    }

    // 本文
    if (data.content) {
        body.innerHTML = `<div class="proposal-display">${esc(data.content)}</div>`;
    }

    // 投票結果
    if (data.votes) {
        Object.entries(data.votes).forEach(([id, vote]) => {
            const el = document.getElementById(`voteResult-${id}`);
            if (el) {
                if (vote === "support") {
                    el.textContent = "✅ 賛成";
                    el.className = "vr-result support";
                } else {
                    el.textContent = "❌ 反対";
                    el.className = "vr-result oppose";
                }
            }
        });
    }
}

// ============================================================
// ユーティリティ
// ============================================================
function esc(text) {
    const d = document.createElement("div");
    d.textContent = text;
    return d.innerHTML.replace(/\n/g, "<br>");
}

function fmtTime(iso) {
    return new Date(iso).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
}

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}
