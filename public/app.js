import { io } from "https://cdn.socket.io/4.7.1/socket.io.esm.min.js";

const socket = io();

let selectedAvatar = null;
let username = null;
let currentRoom = null;
let isRoomOwner = false;

const avatarListEl = document.getElementById('avatarList');
const usernameInput = document.getElementById('usernameInput');
const btnLogin = document.getElementById('btnLogin');

const loginScreen = document.getElementById('loginScreen');
const mainMenu = document.getElementById('mainMenu');
const createRoomScreen = document.getElementById('createRoomScreen');
const joinRoomScreen = document.getElementById('joinRoomScreen');
const chatScreen = document.getElementById('chatScreen');

const roomNameInput = document.getElementById('roomNameInput');
const roomPinInput = document.getElementById('roomPinInput');

const joinRoomNameInput = document.getElementById('joinRoomNameInput');
const joinRoomPinInput = document.getElementById('joinRoomPinInput');

const messagesEl = document.getElementById('messages');
const messageInput = document.getElementById('messageInput');
const btnSendMessage = document.getElementById('btnSendMessage');

const chatRoomName = document.getElementById('chatRoomName');
const btnLeaveRoom = document.getElementById('btnLeaveRoom');

const onlineCountEl = document.getElementById('onlineCount');
const onlineUsersEl = document.getElementById('onlineUsers');
const typingStatusEl = document.getElementById('typingStatus');
const clockEl = document.getElementById('clock');

/* SAAT */
function setClock() {
    const now = new Date();
    clockEl.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
setInterval(setClock, 1000);
setClock();

/* Avatar Listesi */
const avatars = ['🧑‍💻','👩‍🎤','👨‍🚀','👩‍🍳','🧙‍♂️','👻','🐱','🐶','🐵','🦊'];
avatars.forEach(av => {
    const span = document.createElement('span');
    span.textContent = av;
    span.style.cursor = 'pointer';
    span.style.fontSize = '30px';
    span.onclick = () => {
        selectedAvatar = av;
        document.querySelectorAll('#avatarList span').forEach(s => s.classList.remove('selected'));
        span.classList.add('selected');
    };
    avatarListEl.appendChild(span);
});

/* Login */
btnLogin.onclick = () => {
    if (!selectedAvatar) return alert('Lütfen avatar seçin!');
    if (!usernameInput.value.trim()) return alert('Lütfen isim yazın!');

    username = usernameInput.value.trim();

    loginScreen.classList.add('hidden');
    mainMenu.classList.remove('hidden');
};

/* Menü butonları */
document.getElementById('btnCreateRoom').onclick = () => {
    mainMenu.classList.add('hidden');
    createRoomScreen.classList.remove('hidden');
};

document.getElementById('btnJoinRoom').onclick = () => {
    mainMenu.classList.add('hidden');
    joinRoomScreen.classList.remove('hidden');
};

document.querySelectorAll('.btnBack').forEach(btn => {
    btn.onclick = () => {
        createRoomScreen.classList.add('hidden');
        joinRoomScreen.classList.add('hidden');
        mainMenu.classList.remove('hidden');
    };
});

/* Oda oluştur */
document.getElementById('btnCreateRoomConfirm').onclick = () => {
    const roomName = roomNameInput.value.trim();
    const pin = roomPinInput.value.trim();
    if (!roomName || !pin) return alert('Oda ve PIN şart');

    socket.emit('createRoom', { roomName, pin, username, avatar: selectedAvatar }, (res) => {
        if (res.error) return alert(res.error);
        currentRoom = roomName;
        isRoomOwner = true;
        openChat();
    });
};

/* Odaya katıl */
document.getElementById('btnJoinRoomConfirm').onclick = () => {
    const roomName = joinRoomNameInput.value.trim();
    const pin = joinRoomPinInput.value.trim();
    if (!roomName || !pin) return alert('Oda ve PIN şart');

    socket.emit('joinRoom', { roomName, pin, username, avatar: selectedAvatar }, (res) => {
        if (res.error) return alert(res.error);
        currentRoom = roomName;
        isRoomOwner = false;
        openChat();
    });
};

/* Odayı aç */
function openChat() {
    createRoomScreen.classList.add('hidden');
    joinRoomScreen.classList.add('hidden');
    mainMenu.classList.add('hidden');

    chatScreen.classList.remove('hidden');
    chatRoomName.textContent = currentRoom;
    messagesEl.innerHTML = '';
}

/* Mesaj gönder */
btnSendMessage.onclick = sendMessage;
messageInput.addEventListener('keydown', e => { if (e.key === 'Enter') sendMessage(); });

function sendMessage() {
    const message = messageInput.value.trim();
    if (!message) return;

    socket.emit('sendMessage', { roomName: currentRoom, username, avatar: selectedAvatar, message });
    messageInput.value = '';
    sendTyping(false);
}

/* Yeni mesaj */
socket.on('newMessage', data => {
    const div = document.createElement('div');
    div.innerHTML = `<strong>${data.avatar} ${data.username}:</strong> ${data.message}`;
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
});

/* Yazıyor göstergesi */
messageInput.addEventListener('input', () => {
    sendTyping(messageInput.value.trim().length > 0);
});

function sendTyping(isTyping) {
    socket.emit('typing', { roomName: currentRoom, isTyping });
}

socket.on('typingUsers', typingUsers => {
    typingStatusEl.textContent =
        typingUsers.length === 0 ? '' :
        typingUsers.length === 1 ? `${typingUsers[0]} yazıyor...` :
        `${typingUsers.join(', ')} yazıyor...`;
});

/* Online kullanıcı bilgisi */
socket.on('onlineCount', count => onlineCountEl.textContent = `Online: ${count}`);
socket.on('onlineUsers', users => onlineUsersEl.textContent = users.join(', '));

/* Odadan çık */
btnLeaveRoom.onclick = () => {
    socket.emit('leaveRoom', { roomName: currentRoom });
    currentRoom = null;
    isRoomOwner = false;

    chatScreen.classList.add('hidden');
    mainMenu.classList.remove('hidden');
};

/* SES KAYDI */
let mediaRecorder;
let audioChunks = [];

const btnRecord = document.createElement('button');
btnRecord.textContent = 'Ses Kaydet';
btnRecord.style.marginLeft = '10px';
document.getElementById('chatInputArea').appendChild(btnRecord);

btnRecord.onclick = async () => {
    if (!mediaRecorder || mediaRecorder.state === "inactive") {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        mediaRecorder.start();

        mediaRecorder.ondataavailable = e => audioChunks.push(e.data);

        mediaRecorder.onstop = () => {
            const audioBlob = new Blob(audioChunks, { type: "audio/webm" });
            const reader = new FileReader();
            reader.onloadend = () => {
                socket.emit('sendVoiceMessage', {
                    roomName: currentRoom,
                    username,
                    avatar: selectedAvatar,
                    audioBlob: reader.result
                });
            };
            reader.readAsDataURL(audioBlob);
        };

        btnRecord.textContent = "Kaydı Durdur";
    } else {
        mediaRecorder.stop();
        btnRecord.textContent = "Ses Kaydet";
    }
};

/* Sesli mesaj al */
socket.on('newVoiceMessage', ({ username, avatar, audioBlob }) => {
    const div = document.createElement('div');
    div.innerHTML = `<strong>${avatar} ${username}:</strong> <audio controls src="${audioBlob}"></audio>`;
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
});