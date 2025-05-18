const { app, BrowserWindow, ipcMain } = require("electron");
const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode");
const schedule = require("node-schedule");
const moment = require("moment-timezone");
const fs = require("fs").promises;
const path = require("path");

let client;
let qrWindow;
let mainWindow;

app.disableHardwareAcceleration();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false, // contextIsolation: true önerilir?
    },
  });

  mainWindow.loadFile("index.html");
}

function createQrWindow(qrCodeUrl) {
  qrWindow = new BrowserWindow({
    width: 400,
    height: 400,
    parent: mainWindow,
    modal: true,
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  qrWindow.loadURL(
    `data:text/html;charset=utf-8,<html><body style="display: flex; justify-content: center; align-items: center; height: 100%;"><img src="${qrCodeUrl}" /></body></html>`
  );

  qrWindow.once("ready-to-show", () => {
    qrWindow.show();
  });
}

async function silOturumKlasoru() {
  const authPath = path.join(__dirname, ".wwebjs_auth");

  try {
    await fs.access(authPath);
    await fs.rm(authPath, { recursive: true, force: true });
    console.log("Eski oturum klasörü başarıyla silindi.");
  } catch (err) {
    if (err.code === "ENOENT") {
      console.log("Oturum klasörü bulunamadı, silmeye gerek yok.");
    } else {
      console.error("Oturum klasörü silinirken hata:", err);
    }
  }
}

function registerClientEvents(clientInstance) {
  clientInstance.on("qr", async (qr) => {
    const qrCodeUrl = await qrcode.toDataURL(qr);
    createQrWindow(qrCodeUrl);
    console.log("📱 QR Kodu gösteriliyor, taratın.");
  });

  clientInstance.on("ready", async () => {
    console.log("✅ WhatsApp Bot hazır!");
    if (qrWindow) qrWindow.close();
  });

  clientInstance.on("disconnected", async (reason) => {
    console.log("🔌 Bağlantı koptu:", reason);

    if (reason === "LOGOUT") {
      console.log("Oturum sonlandırıldı, yeniden başlatılıyor...");
      try {
        await clientInstance.destroy();

        client = new Client({
          authStrategy: new LocalAuth(),
          puppeteer: { headless: true },
        });

        registerClientEvents(client);
        await client.initialize();
      } catch (err) {
        console.error("Client yeniden başlatılırken hata:", err);
      }
    }
  });
}

app.whenReady().then(() => {
  createWindow();

  client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { headless: true },
  });

  registerClientEvents(client);
  client.initialize();
});

ipcMain.on("send-message", async (event, { phone, date, time, message }) => {
  try {
    const targetDate = moment
      .tz(`${date} ${time}`, "YYYY-MM-DD HH:mm", "Europe/Istanbul")
      .toDate();

    if (targetDate <= new Date()) {
      return mainWindow.webContents.send(
        "message-error",
        "Tarih geçmişte olamaz!"
      );
    }

    let cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.startsWith("0")) cleanPhone = cleanPhone.slice(1);
    if (cleanPhone.length !== 10) {
      return mainWindow.webContents.send(
        "message-error",
        "Telefon numarası 10 haneli olmalı!"
      );
    }

    

    const fullPhone = `90${cleanPhone}`;
    const chatId = `${fullPhone}@c.us`;

    if (!client || !client.info || !client.info.wid) {
      return mainWindow.webContents.send(
        "message-error",
        "WhatsApp bağlantısı hazır değil!"
      );
    }

    schedule.scheduleJob(targetDate, async () => {
      console.log("MESAJ ZAMANI GELDİ:", targetDate);
      try {
        const response = await client.sendMessage(chatId, message);
        console.log("Mesaj gönderildi:", response?.id?.id || response);
        mainWindow.webContents.send(
          "message-sent",
          "Mesaj başarıyla gönderildi!"
        );
      } catch (error) {
        console.error(" Mesaj gönderilemedi:", error.stack);
        mainWindow.webContents.send(
          "message-error",
          "Mesaj gönderilemedi: " + error.message
        );
      }
    });

    console.log("Mesaj zamanlandı:", targetDate);
  } catch (err) {
    console.error("Kritik hata:", err.stack);
    mainWindow.webContents.send(
      "message-error",
      "Bir şeyler ters gitti: " + err.message
    );
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
