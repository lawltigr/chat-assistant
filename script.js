const listenBtn = document.getElementById('listenBtn');
const speakToggleBtn = document.getElementById('speakToggleBtn');
const voiceLangSel = document.getElementById('voiceLang');
const SPEAK_ENABLED_KEY = 'mini_chat_tts_enabled';
const VOICE_LANG_KEY = 'mini_chat_voice_lang';
const API_KEY_KEY = 'mini_chat_api_key';
const toggleAiBtn = document.getElementById('toggleAiBtn');
const setupKeyBtn = document.getElementById('setupKeyBtn');
let recognition = null;
let isListening = false;
const AI_ENABLED_KEY = 'mini_chat_ai_enabled';
const APU_KEY_KEY = 'mini_chat_api_key';
const clearBtn = document.getElementById('clearBtn');
const VOICE_PITCH_KEY = 'mini_chat_voice_pitch';
const VOICE_ID_KEY = 'mini_chat_voice_id';
const voiceSelect = document.getElementById('voiceSelect');
let availableVoices = [];


function getApiKey(){
    return localStorage.getItem(API_KEY_KEY) || '';
}
function setApiKey(k){
    localStorage.setItem(API_KEY_KEY, (k || '').trim());
}
function isAiEnabled(){
    return localStorage.getItem(AI_ENABLED_KEY) === '1';
}
function setAiEnabled(on){
    localStorage.setItem(AI_ENABLED_KEY, on ? '1' : '0');
    toggleAiBtn.textContent = 'AI: ' + (on ? 'On' : 'Off');
}

setAiEnabled(isAiEnabled());
toggleAiBtn.addEventListener('click', ()=> {
    const on = !isAiEnabled();
    if (on && !getApiKey()){
        const k = prompt('Insert API key (OpenAI or OpenRouter). It will be saved in Local storage: ', '');
        if (!k) return;
        setApiKey(k);
    }
    setAiEnabled(on);
});

setupKeyBtn.addEventListener('click', () =>{
    const current = getApiKey();
    const k = prompt('API key (you can use OpenAI sj-... or OpenRouter sk-or-v1-...): ', current);
    if (k != null) setApiKey(k);
});

function currentEndpoint(){
    const k = getApiKey();
    if (!k) return null;

    if (k.startsWith('sk-or-v1-')){
        return {
            url: 'https://openrouter.ai/api/v1/chat/completions',
            model: 'openai/gpt-4o-mini',
            extraHeaders: {
                'HTTP-Referer': location.origin,
                'X-Title': 'Mini Chat'
            }
        };
    }
    return{
        url: 'https://api.openai.com/v1/chat/completions',
        model: 'gpt-4o-mini',
        extraHeaders: {}
    };
}

function lastMessagesAsOpenAi(n){
    return [];
}

async function callAiChat(userText, temperature=0.7){
    const apiKey = getApiKey();
    if (!apiKey) throw new Error('No API Key');
    const ep = currentEndpoint();
    if (!ep) throw new Error('Endpoint not resolved');

    const body = {
        model: ep.model,
        messages: [
            {
                role: 'system', content: 'You are a helpful assistant. Keep answers concise.'
            }, 
            ...lastMessagesAsOpenAi(6),
            {
                role: 'user', content: userText
            }
        ], 
        temperature
    };
    const res = await fetch(ep.url, {
        method: 'POST',
        headers: {
            'Authorization': 'Bearer ' + apiKey,
            'Content-Type': 'application/json',
            ...ep.extraHeaders
        },
        body: JSON.stringify(body)
    });
    if (!res.ok){
        const text = await res.text().catch(()=> '');
        throw new Error(`HTTP ${res.status} ${res.statusText} ${text}`)
    }
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error('Empty AI response');
    return content;
}

function addUserMessage(text){
    console.log('User: ', text);

    const msg = document.createElement('div');
    msg.classList.add('message');
    msg.textContent = 'You: ' + text;
    document.body.appendChild(msg);
}
async function simulateBotReply(text){
    if (!isAiEnabled() || !getApiKey()){
        const reply = 'You said: ' + text;
        console.log('Bot: ', reply);
        speakIfEnabled(reply);
        const msg = document.createElement('div');
        msg.classList.add('message');
        msg.textContent = reply;
        document.body.appendChild(msg);
        return;
    }
    const loading = document.createElement('div');
    loading.classList.add('message');
    loading.textContent = 'Thinking...';
    document.body.appendChild(loading);
    try {
        const ai = await callAiChat(text);
        loading.textContent = ai;
        speakIfEnabled(ai);
    } catch (err){
        loading.textContent = 'AI error: ' + (err.message || 'request failed');
        speakIfEnabled(loading.textContent)
    }
}

function getSpeakEnabled(){
    return localStorage.getItem(SPEAK_ENABLED_KEY) === '1';
}


function setSpeakEnabled(on){
    localStorage.setItem(SPEAK_ENABLED_KEY, on ? '1' : '0');
    speakToggleBtn.textContent = 'Speak: ' + (on ? 'On' : 'Off');
}
function getVoiceLang(){
    return localStorage.getItem(VOICE_LANG_KEY) || voiceLangSel.value || 'en-US';
}
function setVoiceLang(v){
    localStorage.setItem(VOICE_LANG_KEY, v);
    voiceLangSel.value = v;
}
setSpeakEnabled(getSpeakEnabled());
setVoiceLang(getVoiceLang());

function speak(text, lang = getVoiceLang()){
    try{
        if (!window.speechSynthesis) return;
        const utter = new SpeechSynthesisUtterance(text);
        utter.lang = lang;
        utter.pitch = getVoicePitch();
        utter.rate = 1;
        utter.volume = 1;
        const pickVoice = () =>{
            const voices = speechSynthesis.getVoices() || [];
            const v = voices.find(v => v.lang === lang) || voices.find(v => v.lang.startsWith(lang.split('-')[0])) || voices[0];
            if (v) utter.voice = v;
        };
        let voices = speechSynthesis.getVoices();
        if (!voices || voices.length === 0){
            speechSynthesis.onvoiceschanged = () =>{
                pickVoice(); speechSynthesis.speak(utter);
            };
        }
        else{
            pickVoice(); speechSynthesis.speak(utter);
        }
    }
    catch (e){
        console.warn('TTS error:', e);
    }
}
function speakIfEnabled(text){
    if (getSpeakEnabled()) speak(text);
}
//STT (voice recognition) SpeakToText
function getRecognition(){
    //webkitSpeechRecognition is in Chrome/Edge;
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Ctor) return null;
    const rec = new Ctor();
    rec.lang = getVoiceLang();
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    return rec;
}
function startListening(){
    if (isListening) return;
    recognition = getRecognition();
    if (!recognition){
        alert ('Speech recognition is not supported in this browser.');
        return;
    }
    isListening = true;
    listenBtn.textContent = 'Stop';
    recognition.lang = getVoiceLang();
    recognition.onresult = (e) => {
        const text = (e.results?.[0]?.[0]?.transcript || '').trim();
        if (text){
            addUserMessage(text);
            simulateBotReply(text);
        }
    };
    recognition.onerror = (e) => {
        console.warn('STT error:', e.error || e);
    };
    recognition.onend = () => {
        isListening = false;
        listenBtn.textContent = 'Listen';
    };
    try {
        recognition.start();
    } catch (e) {
        console.warn('recognition.start error:', e);
        isListening = false;
        listenBtn.textContent = 'Listen';
    }
}
function stopListening(){
    if (!recognition || !isListening) return;
    try {
        recognition.stop();
    } catch {}
    isListening = false;
    listenBtn.textContent = 'Listen';
}

listenBtn.addEventListener('click', () => {
    if (isListening) stopListening(); 
    else {
        startListening();
    }
});
speakToggleBtn.addEventListener('click', () => {
    setSpeakEnabled(!getSpeakEnabled());
});

voiceLangSel.addEventListener('change', () => {
    setVoiceLang(voiceLangSel.value);
    if (isListening){
        stopListening();
        setTimeout(startListening, 100);
    }
});

clearBtn.addEventListener('click', () => {
    if (!confirm('Are you sure you want to clear the chat?')) return;
    const messages = document.querySelectorAll('.message');
    messages.forEach(m => m.remove());
    localStorage.removeItem('mini_chat_messages_v1');
    if (window.messages) window.messages = [];
    console.log('Chat cleared.');
})

function getVoicePitch(){
    return parseFloat(localStorage.getItem(VOICE_PITCH_KEY)) || 1;
}
function setVoicePitch(v){
    localStorage.setItem(VOICE_PITCH_KEY, v);
    document.getElementById('voicePitch').value = v;
}
setVoicePitch(getVoicePitch());

document.getElementById('voicePitch').addEventListener('input', (e) => {
    setVoicePitch(e.target.value);
});

speakIfEnabled(ai);

function loadVoices(){
    availableVoices = speechSynthesis.getVoices();
    voiceSelect.innerHTML ='';

    availableVoices.forEach((v, i) => {
        const option = document.createElement('option');
        option.value = v.voiceURI;
        option.textContent = `${v.name} (${v.lang})`;
        voiceSelect.appendChild(option);
    });

    const saved = localStorage.getItem(VOICE_ID_KEY);
    if (saved) voiceSelect.value = saved;
}
speechSynthesis.onvoiceschanged = loadVoices;
loadVoices();
voiceSelect.addEventListener('change', () => {
    localStorage.setItem(VOICE_ID_KEY, voiceSelect.value);
});