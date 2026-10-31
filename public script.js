const introScreen = document.getElementById('intro-screen');
const chatScreen = document.getElementById('chat-screen');
const type1 = document.getElementById('type-line1');
const type2 = document.getElementById('type-line2');
const chatContainer = document.getElementById('chat-container');
const messagesDiv = document.getElementById('messages');
const inputField = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
const stopBtn = document.getElementById('stop-btn');
const newChatBtn = document.getElementById('new-chat-btn');
const welcomeMsg = document.getElementById('welcome-message');

let sessionId = 'session_' + Math.random().toString(36).substring(2, 9);
let isGenerating = false;
let abortController = null;
let currentAIMessageDiv = null;

// --- INTRO ANIMATION LOGIC ---
const text1 = "HELLO, THIS IS VIRUS AI";
const text2 = "THINK. CODE. BUILD.";
let i = 0, j = 0;

function typeWriter() {
    if (i < text1.length) {
        type1.innerHTML += text1.charAt(i);
        i++;
        setTimeout(typeWriter, 50);
    } else if (j < text2.length) {
        type2.innerHTML += text2.charAt(j);
        j++;
        setTimeout(typeWriter, 50);
    } else {
        setTimeout(() => {
            introScreen.style.opacity = '0';
            setTimeout(() => {
                introScreen.classList.add('hidden');
                chatScreen.classList.remove('hidden');
                inputField.focus();
            }, 1000);
        }, 1500);
    }
}
setTimeout(typeWriter, 500);

// --- CHAT LOGIC ---

inputField.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
});

inputField.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

sendBtn.addEventListener('click', sendMessage);

newChatBtn.addEventListener('click', () => {
    sessionId = 'session_' + Math.random().toString(36).substring(2, 9);
    messagesDiv.innerHTML = '';
    welcomeMsg.classList.remove('hidden');
    inputField.value = '';
});

function stopGeneration() {
    if (abortController) {
        abortController.abort();
        isGenerating = false;
        updateButtons();
        if (currentAIMessageDiv) {
            currentAIMessageDiv.innerHTML += "<br><br><span style='color:#888;'>[Generation stopped]</span>";
        }
    }
}
stopBtn.addEventListener('click', stopGeneration);

function updateButtons() {
    if (isGenerating) {
        sendBtn.classList.add('hidden');
        stopBtn.classList.remove('hidden');
    } else {
        sendBtn.classList.remove('hidden');
        stopBtn.classList.add('hidden');
    }
}

async function sendMessage() {
    const text = inputField.value.trim();
    if (!text || isGenerating) return;

    inputField.value = '';
    inputField.style.height = 'auto';
    welcomeMsg.classList.add('hidden');

    const userDiv = document.createElement('div');
    userDiv.className = 'message user-message';
    userDiv.innerText = text;
    messagesDiv.appendChild(userDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;

    const aiDiv = document.createElement('div');
    aiDiv.className = 'message ai-message';
    messagesDiv.appendChild(aiDiv);
    
    currentAIMessageDiv = aiDiv;
    let rawResponse = "";
    
    isGenerating = true;
    updateButtons();

    try {
        abortController = new AbortController();
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: text, sessionId: sessionId }),
            signal: abortController.signal
        });

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n\n');

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const dataStr = line.slice(6);
                    if (dataStr === '[DONE]') continue;
                    
                    try {
                        const data = JSON.parse(dataStr);
                        if (data.error) {
                            aiDiv.innerText = data.error;
                            break;
                        }
                        if (data.text) {
                            rawResponse += data.text;
                            renderMarkdown(rawResponse, aiDiv);
                            chatContainer.scrollTop = chatContainer.scrollHeight;
                        }
                    } catch (e) {}
                }
            }
        }
    } catch (err) {
        if (err.name === 'AbortError') {
            console.log("Fetch aborted");
        } else {
            aiDiv.innerText = "System error: Connection to VIRUS AI core failed.";
        }
    } finally {
        isGenerating = false;
        updateButtons();
        abortController = null;
    }
}

// --- MARKDOWN & CODE BLOCK RENDERER ---
function renderMarkdown(text, targetDiv) {
    const codeBlockRegex = /```(\w+)(?::([^\n]+))?\n([\s\S]*?)```/g;
    
    let html = "";
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(text)) !== null) {
        const textBefore = text.substring(lastIndex, match.index);
        html += escapeHtml(textBefore).replace(/\n/g, '<br>');
        
        const lang = match[1] || 'text';
        const filename = match[2] || `${lang}-file`;
        const code = match[3];

        html += `
            <div class="code-container">
                <div class="code-header">
                    <span>${filename} (${lang})</span>
                    <div>
                        <button onclick="copyCode(this)">COPY</button>
                        <button onclick="downloadCode(this, '${filename}')">DOWNLOAD</button>
                    </div>
                </div>
                <pre><code class="code-block">${escapeHtml(code)}</code></pre>
            </div>
        `;
        
        lastIndex = codeBlockRegex.lastIndex;
    }

    const textAfter = text.substring(lastIndex);
    html += escapeHtml(textAfter).replace(/\n/g, '<br>');

    targetDiv.innerHTML = html;
}

function escapeHtml(unsafe) {
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}

window.copyCode = function(btn) {
    const code = btn.closest('.code-container').querySelector('code').innerText;
    navigator.clipboard.writeText(code).then(() => {
        btn.innerText = "COPIED!";
        setTimeout(() => btn.innerText = "COPY", 2000);
    });
}

window.downloadCode = function(btn, filename) {
    const code = btn.closest('.code-container').querySelector('code').innerText;
    const blob = new Blob([code], {type: 'text/plain'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
                                          }
