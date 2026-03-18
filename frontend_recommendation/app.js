const API_BASE = 'http://localhost:8000/api/recommendation';

const durSlider = document.getElementById('duration');
const durVal = document.getElementById('durVal');
const getRecsBtn = document.getElementById('getRecsBtn');
const recsList = document.getElementById('recommendationsList');

// Update duration slider text
durSlider.addEventListener('input', (e) => {
    durVal.textContent = e.target.value;
});

// Currently loaded predictions so we can pass probability in reward call
let currentPredictions = [];

async function generateRecommendations() {
    const inputtype_id = parseInt(document.getElementById('inputType').value);
    const duration_sec = parseInt(durSlider.value) * 60; // Convert min to sec
    const platform_id = parseInt(document.getElementById('platform').value);

    // UX updates
    getRecsBtn.disabled = true;
    getRecsBtn.textContent = 'Generating...';
    recsList.innerHTML = '<div class="empty-state">Calculating AI strategy...</div>';

    try {
        const response = await fetch(`${API_BASE}/bandit_predict`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ inputtype_id, duration_sec, platform_id })
        });
        
        if (!response.ok) throw new Error('API Error');
        const data = await response.json();
        currentPredictions = data.recommendations;
        
        renderRecommendations(currentPredictions, inputtype_id, duration_sec, platform_id);

    } catch (e) {
        recsList.innerHTML = `<div class="empty-state" style="color: #ff7675;">Failed to connect to backend. Is the Python server running?</div>`;
    } finally {
        getRecsBtn.disabled = false;
        getRecsBtn.textContent = 'Generate AI Strategy';
    }
}

function renderRecommendations(recs, it_id, dur, plat_id) {
    recsList.innerHTML = '';
    
    // Animate staggering
    recs.forEach((rec, index) => {
        const pct = (rec.probability * 100).toFixed(1);
        const card = document.createElement('div');
        card.className = 'rec-card';
        card.style.animationDelay = `${index * 0.1}s`;
        
        // Color coding top choice
        const isTop = index === 0;
        const glowStyle = isTop ? 'box-shadow: 0 0 15px rgba(0, 210, 211, 0.2); border-color: rgba(0, 210, 211, 0.5);' : '';
        
        card.innerHTML = `
            <div class="rec-info">
                <div class="rec-name" style="${isTop ? 'color: var(--success);' : ''}">
                    ${isTop ? '✨ ' : ''}${rec.output_type_name}
                </div>
                <div class="prob-bar-container">
                    <div class="prob-bar" style="width: ${pct}%;"></div>
                </div>
                <div class="prob-text">Win Probability: ${pct}%</div>
            </div>
            <button class="publish-btn" onclick="publishAction(${rec.output_type_id}, ${rec.probability}, ${it_id}, ${dur}, ${plat_id}, this)">
                Publish! 🚀
            </button>
        `;
        recsList.appendChild(card);
    });
}

// Emulate a successful publish!
async function publishAction(action_id, prob, input_id, dur_sec, plat_id, btnElement) {
    // Immediate visual feedback
    const originalText = btnElement.innerHTML;
    btnElement.innerHTML = 'Learning... 🧠';
    btnElement.style.background = 'var(--success)';
    btnElement.style.color = 'var(--bg-dark)';
    btnElement.disabled = true;

    // Send a massive reward of 5.0 to instantly influence the Bandit
    try {
        await fetch(`${API_BASE}/bandit_reward`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                inputtype_id: input_id,
                duration_sec: dur_sec,
                platform_id: plat_id,
                output_type_id: action_id,
                reward: 5.0,
                probability: prob
            })
        });

        // Bandit policy updated! Re-generate to show the new probabilities
        await generateRecommendations();
        
    } catch (e) {
        alert('Failed to log reward logic to Vowpal Wabbit backend.');
        btnElement.innerHTML = originalText;
        btnElement.disabled = false;
        btnElement.style.background = 'transparent';
        btnElement.style.color = 'var(--success)';
    }
}

// Bind button
getRecsBtn.addEventListener('click', generateRecommendations);
