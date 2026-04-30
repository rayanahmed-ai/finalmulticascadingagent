/**
 * background.js - LLM Guardrail Extension Service Worker
 * 
 * Receives prompt check requests from content.js and popup.js,
 * calls the Python guardrail server, and returns the decision.
 */

// Default local server
const DEFAULT_SERVER = "http://127.0.0.1:5001/check";

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "CHECK_PROMPT") {
        const prompt = message.prompt;

        // Get the server URL from storage, or use default
        chrome.storage.local.get(["serverUrl"], (result) => {
            let serverUrl = result.serverUrl || DEFAULT_SERVER;
            
            // Ensure endpoint is /check
            if (!serverUrl.endsWith("/check")) {
                serverUrl = serverUrl.replace(/\/$/, "") + "/check";
            }

            fetch(serverUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt })
            })
                .then((res) => res.json())
                .then((data) => {
                    sendResponse({
                        action: data.action || "block",
                        risk_level: data.risk_level || "unknown",
                        reason: data.reason || "No reason provided",
                        blocked_agents: data.blocked_agents || [],
                        error: null
                    });
                })
                .catch((err) => {
                    console.error("[LLM Guardrail] Server unreachable:", err);
                    // If server is down, ALLOW by default (fail-open)
                    sendResponse({
                        action: "allow",
                        risk_level: "unknown",
                        reason: `⚠️ Guardrail server unreachable at ${serverUrl}. Prompt allowed.`,
                        blocked_agents: [],
                        error: err.message
                    });
                });
        });

        // Return true to keep the message channel open for async response
        return true;
    }
});

