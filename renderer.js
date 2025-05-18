const { ipcRenderer } = require("electron");

document.getElementById("sendBtn").addEventListener("click", () => {
  const phone = document.getElementById("phone").value;
  const date = document.getElementById("date").value;
  const time = document.getElementById("time").value;
  const message = document.getElementById("message").value;

  if (!phone || !date || !time || !message) {
    alert("Lütfen tüm alanları doldurun!");
    return;
  }

  // Telefon numarasını doğrudan gönderiyoruz, main.js tarafında formatlanacak
  console.log("IPC gönderiliyor:", { phone, date, time, message });
  ipcRenderer.send("send-message", { phone, date, time, message });
  console.log("IPC gönderildi.");
  alert(`Mesaj ${date} tarihinde, ${time} saatinde gönderilecek.`);
});

// IPC cevaplarını dinleyin
ipcRenderer.on("message-sent", (event, message) => {
  alert(message); // Kullanıcıya mesajın gönderildiğini bildirin
});

ipcRenderer.on("message-error", (event, message) => {
  alert(message); // Mesaj gönderilemediği bilgisini göster
});
