/**
 * popup.js - LLM Guardrail Popup Logic
 * Handles manual prompt testing and server status checking.
 */

const promptInput = document.getElementById("prompt-input");
const checkBtn = document.getElementById("check-btn");
const btnText = document.getElementById("btn-text");
const btnSpinner = document.getElementById("btn-spinner");
const resultCard = document.getElementById("result-card");
const resultIcon = document.getElementById("result-icon");
const resultAction = document.getElementById("result-action");
const resultRisk = document.getElementById("result-risk");
const resultReason = document.getElementById("result-reason");
const resultAgents = document.getElementById("result-agents");
const statusDot = document.getElementById("server-status");

// HF Elements
const hfModelId = document.getElementById("hf-model-id");
const hfTask = document.getElementById("hf-task");
const hfPrompt = document.getElementById("hf-prompt");
const hfRunBtn = document.getElementById("hf-run-btn");
const hfBtnText = document.getElementById("hf-btn-text");
const hfBtnSpinner = document.getElementById("hf-btn-spinner");
const hfResultContainer = document.getElementById("hf-result-container");
const hfOutputText = document.getElementById("hf-output-text");
const hfOutputImage = document.getElementById("hf-output-image");

// Settings Elements
const apiUrlInput = document.getElementById("api-url-input");
const saveSettingsBtn = document.getElementById("save-settings-btn");
const currentServerText = document.getElementById("current-server-text");

// Default
const DEFAULT_SERVER = "http://127.0.0.1:5001";

// ─── Tabs ───────────────────────────────────────────────────────────────────
const tabBtns = document.querySelectorAll(".tab-btn");
const tabContents = document.querySelectorAll(".tab-content");

tabBtns.forEach(btn => {
    btn.addEventListener("click", () => {
        const tabId = btn.getAttribute("data-tab");

        tabBtns.forEach(b => b.classList.remove("active"));
        tabContents.forEach(c => c.classList.remove("active"));

        btn.classList.add("active");
        document.getElementById(`tab-${tabId}`).classList.add("active");

        // Hide result card when switching tabs
        resultCard.classList.add("hidden");
    });
});

// ─── Server Configuration ───────────────────────────────────────────────────
async function getServerUrl() {
    return new Promise((resolve) => {
        chrome.storage.local.get(["serverUrl"], (result) => {
            resolve(result.serverUrl || DEFAULT_SERVER);
        });
    });
}

async function checkServerStatus() {
    const baseUrl = await getServerUrl();
    const cleanUrl = baseUrl.replace(/\/$/, "");
    
    currentServerText.innerHTML = `Pipeline: <code>${cleanUrl}</code>`;
    apiUrlInput.value = cleanUrl;

    try {
        const res = await fetch(`${cleanUrl}/`, { method: "GET" });
        if (res.ok) {
            statusDot.className = "status-dot status-online";
            statusDot.title = "Guardrail server is online";
        } else {
            throw new Error("Offline");
        }
    } catch {
        statusDot.className = "status-dot status-offline";
        statusDot.title = "Guardrail server is offline";
    }
}

saveSettingsBtn.addEventListener("click", () => {
    const newUrl = apiUrlInput.value.trim();
    if (!newUrl) return;

    chrome.storage.local.set({ serverUrl: newUrl }, () => {
        alert("Settings saved!");
        checkServerStatus();
    });
});

checkServerStatus();

// ─── UI Helpers ───────────────────────────────────────────────────────────────
function setLoading(btn, textEl, spinnerEl, isLoading) {
    btn.disabled = isLoading;
    textEl.classList.toggle("hidden", isLoading);
    spinnerEl.classList.toggle("hidden", !isLoading);
}

function showResultCard(response) {
    const isAllow = response.action === "allow";
    resultCard.className = `result-card ${isAllow ? "allow" : "block"}`;
    resultCard.classList.remove("hidden");
    resultIcon.textContent = isAllow ? "✅" : "❌";
    resultAction.textContent = isAllow ? "Prompt Allowed" : "Prompt Blocked";
    resultRisk.textContent = response.risk_level ? `Risk Level: ${response.risk_level}` : "";
    resultReason.textContent = response.reason || response.message || "";

    if (response.blocked_agents && response.blocked_agents.length > 0) {
        resultAgents.textContent = `Blocked by: ${response.blocked_agents.join(", ")}`;
        resultAgents.classList.remove("hidden");
    } else {
        resultAgents.classList.add("hidden");
    }
}

// ─── Standard Prompt Check ────────────────────────────────────────────────────
checkBtn.addEventListener("click", () => {
    const prompt = promptInput.value.trim();
    if (!prompt) return;

    setLoading(checkBtn, btnText, btnSpinner, true);
    resultCard.classList.add("hidden");

    chrome.runtime.sendMessage({ type: "CHECK_PROMPT", prompt }, (response) => {
        setLoading(checkBtn, btnText, btnSpinner, false);
        showResultCard(response || { action: "block", reason: "No response from server" });
    });
});

// ─── Hugging Face Inference ───────────────────────────────────────────────────
hfRunBtn.addEventListener("click", async () => {
    const modelId = hfModelId.value.trim();
    const task = hfTask.value;
    const prompt = hfPrompt.value.trim();

    if (!modelId || !prompt) return;

    setLoading(hfRunBtn, hfBtnText, hfBtnSpinner, true);
    resultCard.classList.add("hidden");
    hfResultContainer.classList.add("hidden");
    hfOutputText.classList.add("hidden");
    hfOutputImage.classList.add("hidden");

    try {
        const baseUrl = await getServerUrl();
        const cleanUrl = baseUrl.replace(/\/$/, "");
        
        const response = await fetch(`${cleanUrl}/inference`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ model_id: modelId, task, prompt })
        });

        const data = await response.json();

        if (data.action === "block") {
            showResultCard(data);
        } else if (data.action === "allow") {
            showResultCard(data);
            hfResultContainer.classList.remove("hidden");

            if (data.task === "text-to-image") {
                hfOutputImage.src = `data:image/png;base64,${data.image_data}`;
                hfOutputImage.classList.remove("hidden");
            } else {
                hfOutputText.textContent = data.output;
                hfOutputText.classList.remove("hidden");
            }
        } else {
            showResultCard({ action: "block", reason: data.error || "Unknown error" });
        }
    } catch (err) {
        showResultCard({ action: "block", reason: "Failed to connect to server: " + err.message });
    } finally {
        setLoading(hfRunBtn, hfBtnText, hfBtnSpinner, false);
    }
});


