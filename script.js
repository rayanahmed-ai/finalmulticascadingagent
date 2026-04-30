document.addEventListener('DOMContentLoaded', () => {
    const promptInput = document.getElementById('prompt-input');
    const checkBtn = document.getElementById('check-btn');
    const resultDisplay = document.getElementById('result-display');
    const statusIndicator = document.getElementById('status-indicator');

    const API_URL = window.location.origin + '/check';

    checkBtn.addEventListener('click', async () => {
        const prompt = promptInput.value.trim();
        if (!prompt) {
            alert('Please enter a prompt to analyze.');
            return;
        }

        // Update UI for loading state
        setLoading(true);
        
        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ prompt })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || 'Server responded with an error');
            }

            const data = await response.json();
            displayResult(data);
        } catch (error) {
            console.error('Error:', error);
            displayError('Could not connect to the guardrail server. Make sure server.py is running on port 5001.');
        } finally {
            setLoading(false);
        }
    });

    function setLoading(isLoading) {
        if (isLoading) {
            checkBtn.disabled = true;
            checkBtn.textContent = 'Analyzing...';
            statusIndicator.textContent = 'Analyzing';
            statusIndicator.className = 'status-loading';
            resultDisplay.innerHTML = '<div class="loader"></div>';
        } else {
            checkBtn.disabled = false;
            checkBtn.textContent = 'Analyze Prompt';
        }
    }

    function displayResult(data) {
        const isBlocked = data.action === 'block';
        
        statusIndicator.textContent = isBlocked ? 'Blocked' : 'Allowed';
        statusIndicator.className = isBlocked ? 'status-block' : 'status-allow';

        let agentsHtml = '';
        if (data.results) {
            agentsHtml = `
                <div class="agent-scores">
                    ${Object.entries(data.results).map(([agent, score]) => `
                        <div class="agent-score-item">
                            <span>${agent.replace('_', ' ').toUpperCase()}</span>
                            <div class="score-bar">
                                <div class="score-fill" style="width: ${score * 100}%"></div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        resultDisplay.innerHTML = `
            <div class="result-verdict" style="color: ${isBlocked ? 'var(--error)' : 'var(--success)'}">
                ${isBlocked ? '⚠️ Blocked' : '✅ Allowed'}
            </div>
            <div class="result-reason">
                <strong>Reason:</strong> ${data.reason || 'No specific reason provided.'}
            </div>
            ${agentsHtml}
        `;
    }

    function displayError(message) {
        statusIndicator.textContent = 'Error';
        statusIndicator.className = 'status-block';
        resultDisplay.innerHTML = `
            <div class="result-verdict" style="color: var(--error)">Request Failed</div>
            <p style="color: var(--text-muted)">${message}</p>
            <p style="font-size: 0.8rem; margin-top: 1rem; color: var(--text-muted)">Tip: Check your Render logs for more details.</p>
        `;
    }

    // Smooth scroll for nav links
    document.querySelectorAll('nav a').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            if (href.startsWith('#')) {
                e.preventDefault();
                document.querySelector(href).scrollIntoView({
                    behavior: 'smooth'
                });
            }
        });
    });
});
