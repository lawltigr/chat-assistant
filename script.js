const listenBtn = document.getElementById('listenBtn');
const speakToggleBtn = document.getElementById('speakToggleBtn');
const voiceLangSel = document.getElementById('voiceLang');
const SPEAK_ENABLED_KEY = 'mini_chat_tts_enabled';
const VOICE_LANG_KEY = 'mini_chat_voice_lang';

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

function speak(text, lang = getVoiceLang){
    try{
        if (!window.speechSynthesis) return;
        const utter = new SpeechSynthesisUtterance(text);
        utter.lang = lang;
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
    if (isListening) stopListening(); elsestartListening();
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