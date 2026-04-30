/**
 * content.js - LLM Guardrail Content Script (v2.8 - Universal & High-Reliability)
 * 
 * Target: Universal interception with specific fixes for Gradio/HuggingFace (Z-Image-Turbo).
 */

(function () {
    "use strict";

    console.log("[LLM Guardrail] 🛡️ Guarding context:", window.location.href);

    let lastActiveInput = null;
    const allowedMap = new Map(); // Cache for (element + text) -> allowed_timestamp

    // ─── Shadow DOM Support ──────────────────────────────────────────────────
    function deepQuerySelectorAll(selector, root = document) {
        let results = Array.from(root.querySelectorAll(selector));
        const pushResults = (node) => {
            if (node.shadowRoot) {
                results = results.concat(deepQuerySelectorAll(selector, node.shadowRoot));
            }
            node.querySelectorAll("*").forEach(pushResults);
        };
        root.querySelectorAll("*").forEach(n => {
            if (n.shadowRoot) {
                results = results.concat(deepQuerySelectorAll(selector, n.shadowRoot));
            }
        });
        return results;
    }

    // ─── UI: Show blocked banner ──────────────────────────────────────────────
    function showBlockedBanner(reason) {
        if (document.getElementById("llm-guardrail-banner")) return;

        const banner = document.createElement("div");
        banner.id = "llm-guardrail-banner";
        banner.style.cssText = `
            position: fixed; top: 15px; left: 50%; transform: translateX(-50%);
            z-index: 2147483647; background: #3b0a0a; border: 2px solid #ff4444; 
            border-radius: 10px; padding: 15px 25px; color: #fff; font-family: sans-serif; 
            box-shadow: 0 10px 30px rgba(0,0,0,0.6); display: flex; align-items: center; gap: 15px;
        `;

        banner.innerHTML = `
            <span style="font-size:24px;">⛔</span>
            <div><b style="color:#ff6666">Blocked by AI Guardrails:</b><br/>${reason}</div>
            <button onclick="this.parentElement.remove()" style="background:none;border:none;color:#fff;cursor:pointer;font-weight:bold;font-size:20px;">×</button>
        `;
        document.body.appendChild(banner);
        setTimeout(() => banner.remove(), 8000);
    }

    // ─── Network ─────────────────────────────────────────────────────────────
    function checkPrompt(promptText, callback) {
        chrome.runtime.sendMessage({ type: "CHECK_PROMPT", prompt: promptText }, (response) => {
            if (chrome.runtime.lastError) {
                console.warn("[LLM Guardrail] Extension Error:", chrome.runtime.lastError.message);
                callback({ action: "allow" });
                return;
            }
            callback(response);
        });
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────
    function getVal(el) {
        if (!el) return "";
        return (el.value || el.innerText || el.textContent || "").trim();
    }

    function isInput(el) {
        if (!el) return false;
        const tag = el.tagName;
        const holder = (el.placeholder || "").toLowerCase();
        const role = el.getAttribute("role");
        const tid = (el.getAttribute("data-testid") || "").toLowerCase();
        const areaLabel = (el.getAttribute("aria-label") || "").toLowerCase();

        const isCommonAI = tid.includes("textbox") || tid.includes("chat") || tid.includes("input") || tid.includes("prompt");
        const isCommonTag = tag === "TEXTAREA" || (tag === "INPUT" && el.type === "text") || el.contentEditable === "true";
        const hasKeywords = holder.includes("prompt") || holder.includes("message") || holder.includes("generate") ||
            holder.includes("ask") || holder.includes("chat") || holder.includes("type") ||
            areaLabel.includes("prompt") || areaLabel.includes("message");

        return isCommonAI || isCommonTag || hasKeywords || role === "textbox";
    }

    function isBtn(el) {
        if (!el) return false;
        const text = (el.textContent || "").trim().toLowerCase();
        const ariaOrTitle = ((el.getAttribute("aria-label") || "") + (el.getAttribute("title") || "")).toLowerCase();
        const tid = (el.getAttribute("data-testid") || "").toLowerCase();

        const kwords = /send|submit|chat|ask|compute|generate|run|inference|create|🚀|⚡|msg|reply/i;
        const isCommonAI = tid.includes("button") || tid.includes("send") || tid.includes("submit") || tid.includes("generate");

        return el.tagName === "BUTTON" || el.getAttribute("role") === "button" ||
            kwords.test(text) || kwords.test(ariaOrTitle) ||
            el.classList.contains("gr-button") || isCommonAI ||
            text.includes("🚀") || text.includes("⚡");
    }

    // ─── Interception Logic ─────────────────────────────────────────────────
    function handleInterception(event, el, text, triggerAction) {
        // If already allowed recently, skip check
        const key = el;
        if (allowedMap.has(key) && allowedMap.get(key).text === text) {
            console.log("[LLM Guardrail] Safe bypass for allowed prompt.");
            return;
        }

        console.log("[LLM Guardrail] 🛡️ Checking prompt:", text.substring(0, 50));
        event.preventDefault();
        event.stopImmediatePropagation();

        // Feedbak
        const originalOpacity = el.style.opacity;
        el.style.opacity = "0.5";
        el.style.cursor = "wait";

        checkPrompt(text, (result) => {
            el.style.opacity = originalOpacity;
            el.style.cursor = "";

            if (result.action === "block") {
                showBlockedBanner(result.reason);
            } else {
                console.log("[LLM Guardrail] ✅ Safe. Triggering action.");
                allowedMap.set(key, { text: text, time: Date.now() });

                // CRITICAL: Re-triggering the action. 
                // For Z-Image-Turbo and Gradio, a simple .click() or re-dispatch might fail.
                // We use a multi-pronged approach to trigger the app's internal logic.

                // 1. Mark as allowed in dataset so our listener allows the next event
                el.dataset.guardrailAllowed = "true";

                // 2. Trigger the action
                if (triggerAction) triggerAction();

                // 3. Clean up
                setTimeout(() => {
                    delete el.dataset.guardrailAllowed;
                    allowedMap.delete(key);
                }, 1000);
            }
        });
    }

    // ─── Main Listeners ─────────────────────────────────────────────────────

    const onUserAction = (e) => {
        // Find button
        let btn = e.target.closest("button") || e.target.closest("[role='button']") || (isBtn(e.target) ? e.target : null);
        if (!btn || !isBtn(btn)) return;

        // If explicitly allowed by previous check, let it through
        if (btn.dataset.guardrailAllowed === "true") return;

        // Find input
        let input = lastActiveInput;
        if (!input || !document.contains(input) || getVal(input).length === 0) {
            const candidates = deepQuerySelectorAll("textarea, input, [contenteditable]").filter(i => isInput(i) && i.offsetParent !== null);
            if (candidates.length > 0) {
                const bR = btn.getBoundingClientRect();
                candidates.sort((a, b) => {
                    const aR = a.getBoundingClientRect();
                    const bR2 = b.getBoundingClientRect();
                    return (Math.abs(aR.top - bR.top) + Math.abs(aR.left - bR.left)) - (Math.abs(bR2.top - bR.top) + Math.abs(bR2.left - bR.left));
                });
                input = candidates[0];
            }
        }

        if (!input) return;
        const text = getVal(input);
        if (!text) return;

        handleInterception(e, btn, text, () => {
            // Re-trigger strategy:
            // A) For buttons, .click() is usually enough if it's a standard listener.
            // B) If not, we re-dispatch the exact same event type.

            console.log("[LLM Guardrail] Re-triggering action on", btn.tagName);

            // Re-dispatch original event type
            const eventType = e.type;
            const newEv = new e.constructor(eventType, e);
            Object.defineProperty(newEv, 'target', { writable: false, value: e.target });
            btn.dispatchEvent(newEv);

            // Also trigger a click as backup
            if (eventType !== "click") {
                setTimeout(() => btn.click(), 50);
            }
        });
    };

    // Tracking
    document.addEventListener("focusin", (e) => { if (isInput(e.target)) lastActiveInput = e.target; }, true);
    document.addEventListener("input", (e) => { if (isInput(e.target)) lastActiveInput = e.target; }, true);

    // Enter Key
    document.addEventListener("keydown", (e) => {
        if (e.key !== "Enter" || e.shiftKey || !isInput(e.target)) return;
        if (e.target.dataset.guardrailAllowed === "true") return;

        const text = getVal(e.target);
        if (!text) return;

        handleInterception(e, e.target, text, () => {
            const newEv = new KeyboardEvent("keydown", e);
            e.target.dispatchEvent(newEv);
        });
    }, true);

    // Submissions
    document.addEventListener("submit", (e) => {
        if (e.target.dataset.guardrailAllowed === "true") return;
        const input = e.target.querySelector("textarea, input");
        const text = getVal(input);
        if (!text) return;
        handleInterception(e, e.target, text, () => e.target.submit());
    }, true);

    // Attach to all likely triggers
    ["click", "mousedown", "pointerdown", "touchstart"].forEach(t => {
        document.addEventListener(t, onUserAction, true);
    });

    // Label inputs
    setInterval(() => {
        deepQuerySelectorAll("textarea, input").forEach(i => {
            if (isInput(i) && !i.dataset.grMarked) {
                i.dataset.grMarked = "true";
                i.style.borderLeft = "5px solid #6366f1";
                i.title = "[Monitoring Active]";
            }
        });
    }, 3000);

    console.log("[LLM Guardrail] ✅ Ready and monitoring.");
})();
