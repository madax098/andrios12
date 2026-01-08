const express = require("express");
const { createServer } = require("http");
const { Server } = require("socket.io");

const app = express();
const server = createServer(app);

// Socket.io ayarları (Render için gerekli)
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Render PORT düzeltmesi (EN ÖNEMLİ KISIM)
const PORT = process.env.PORT || 3000;

// Tüm odalar
const rooms = {};

// Odadaki kullanıcıları güncelle
function updateRoomUsers(roomName) {
    const room = rooms[roomName];
    if (!room) return;

    const users = Object.values(room.users).map(u => u.username);

    io.to(roomName).emit("onlineUsers", users);
    io.to(roomName).emit("onlineCount", users.length);
}

// Statik dosyalar
app.use(express.static("public"));

// Socket bağlantısı
io.on("connection", (socket) => {
    console.log("Yeni kullanıcı bağlandı:", socket.id);

    // ODA OLUŞTURMA
    socket.on("createRoom", ({ roomName, pin, username, avatar }, callback) => {
        if (rooms[roomName]) {
            return callback({ error: "Bu isimde oda zaten var!" });
        }

        rooms[roomName] = {
            pin,
            ownerId: socket.id,
            pinnedMessage: null,
            users: {}
        };

        rooms[roomName].users[socket.id] = {
            username,
            avatar,
            typing: false,
            joinTime: Date.now(),
            voiceMessageCount: 0
        };

        socket.join(roomName);
        updateRoomUsers(roomName);

        callback({ success: true });
    });

    // ODAYA GİRİŞ
    socket.on("joinRoom", ({ roomName, pin, username, avatar }, callback) => {
        const room = rooms[roomName];
        if (!room) return callback({ error: "Oda bulunamadı!" });
        if (room.pin !== pin) return callback({ error: "PIN yanlış!" });

        room.users[socket.id] = {
            username,
            avatar,
            typing: false,
            joinTime: Date.now(),
            voiceMessageCount: 0
        };

        socket.join(roomName);
        updateRoomUsers(roomName);

        callback({
            success: true,
            isOwner: room.ownerId === socket.id,
            pinnedMessage: room.pinnedMessage
        });
    });

    // ODADAN ÇIKIŞ
    socket.on("leaveRoom", ({ roomName }) => {
        const room = rooms[roomName];
        if (!room) return;

        if (room.users[socket.id]) {
            delete room.users[socket.id];
            socket.leave(roomName);
            updateRoomUsers(roomName);

            if (Object.keys(room.users).length === 0) {
                delete rooms[roomName];
            }
        }
    });

    // MESAJ GÖNDERME
    socket.on("sendMessage", ({ roomName, username, avatar, message }) => {
        if (!rooms[roomName]) return;

        io.to(roomName).emit("newMessage", {
            username,
            avatar,
            message,
            timestamp: Date.now()
        });
    });

    // SESLİ MESAJ
    socket.on("sendVoiceMessage", ({ roomName, username, avatar, audioBlob }) => {
        if (!rooms[roomName]) return;

        io.to(roomName).emit("newVoiceMessage", {
            username,
            avatar,
            audioBlob
        });
    });

    // MESAJ SABİTLEME
    socket.on("pinMessage", ({ roomName, messageId, message }) => {
        const room = rooms[roomName];
        if (!room) return;
        if (socket.id !== room.ownerId) return;

        room.pinnedMessage = { messageId, message };
        io.to(roomName).emit("pinnedMessage", room.pinnedMessage);
    });

    // YAZIYOR BİLDİRİMİ
    socket.on("typing", ({ roomName, isTyping }) => {
        const room = rooms[roomName];
        if (!room || !room.users[socket.id]) return;

        room.users[socket.id].typing = isTyping;

        const typingUsers = Object.values(room.users)
            .filter((u) => u.typing)
            .map((u) => u.username);

        io.to(roomName).emit("typingUsers", typingUsers);
    });

    // KULLANICI ATMA
    socket.on("kickUser", ({ roomName, userId }, callback) => {
        const room = rooms[roomName];
        if (!room) return callback({ error: "Oda bulunamadı!" });
        if (socket.id !== room.ownerId) return callback({ error: "Yetkiniz yok!" });

        if (room.users[userId]) {
            io.sockets.sockets.get(userId)?.leave(roomName);
            delete room.users[userId];
            updateRoomUsers(roomName);

            io.to(roomName).emit("userKicked", userId);
            return callback({ success: true });
        }

        callback({ error: "Kullanıcı bulunamadı!" });
    });

    // PIN DEĞİŞTİRME
    socket.on("changePin", ({ roomName, newPin }, callback) => {
        const room = rooms[roomName];
        if (!room) return callback({ error: "Oda bulunamadı!" });
        if (socket.id !== room.ownerId) return callback({ error: "Yetkiniz yok!" });

        room.pin = newPin;
        callback({ success: true });
    });

    // BAĞLANTI KOPTU
    socket.on("disconnect", () => {
        for (const roomName in rooms) {
            const room = rooms[roomName];

            if (room.users[socket.id]) {
                delete room.users[socket.id];
                socket.leave(roomName);
                updateRoomUsers(roomName);

                if (Object.keys(room.users).length === 0) {
                    delete rooms[roomName];
                }
            }
        }

        console.log("Kullanıcı ayrıldı:", socket.id);
    });
});

// SERVER BAŞLAT
server.listen(PORT, () => {
    console.log("Server çalışıyor:", PORT);
});
