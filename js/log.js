document.addEventListener("DOMContentLoaded", () => {
  const logPanel = document.getElementById("logPanel");
  const logList = document.getElementById("logList");
  const logSearch = document.getElementById("logSearch");
  const btnLogs = document.getElementById("btnLogs");
  const menuLogs = document.getElementById("menuLogs");
  const btnCloseLogs = document.getElementById("closeLogs");
  const logsBack = document.getElementById("logsBack");
  const btnClearLogs = document.getElementById("btnClearLogs");

  async function loadLogs() {
    if (!window.currentUser) {
      logList.innerHTML = `<li class="log-empty">Önce giriş yapmalısınız.</li>`;
      return;
    }

    try {
      const res = await authorizedFetch(`${API_URL}/logs`);
      if (!res.ok) throw new Error(await res.text());

      const data = (await res.json()) || [];
      window.currentLogs = Array.isArray(data) ? data : [];
      renderLogs(window.currentLogs);
    } catch (err) {
      console.error("🚨 Logs fetch error:", err);
      logList.innerHTML = `<li class="log-empty">Loglar alınamadı.</li>`;
    }
  }

  window.loadLogs = loadLogs;

  function renderLogs(data) {
    logList.innerHTML = "";
    const q = logSearch.value.toLowerCase().trim();

    const filtered = data.filter((l) => {
      const content = `${l.userName ?? ""} ${l.action ?? ""} ${
        l.details ?? ""
      } ${l.entityType ?? ""} ${l.entityId ?? ""} ${new Date(
        l.createdAt
      ).toLocaleString("tr-TR")}`.toLowerCase();
      return q ? content.includes(q) : true;
    });

    if (!filtered.length) {
      logList.innerHTML = `<li class="log-empty">Log bulunamadı.</li>`;
      return;
    }

    filtered.forEach((l) => {
      const li = document.createElement("li");
      li.className = "log-item";

      const time = new Date(l.createdAt).toLocaleString("tr-TR");
      const entityInfo = l.entityType
        ? `<span class="log-entity">[${l.entityType}${
            l.entityId ? ` #${l.entityId}` : ""
          }]</span>`
        : "";

      li.innerHTML = `
        <div class="log-header">
          <span class="log-time">${time}</span>
          <span class="log-user">${l.userName}</span>
          ${entityInfo}
        </div>
        <div class="log-body">
          <strong>${l.action}</strong>
          ${l.details ? `<br><small>${l.details}</small>` : ""}
        </div>
      `;
      logList.appendChild(li);
    });
  }

  function openLogs() {
    logPanel.style.display = "flex";
    loadLogs();
  }

  function closeLogs() {
    logPanel.style.display = "none";
  }

  window.closeLogs = closeLogs;

  if (btnLogs) {
    btnLogs.addEventListener("click", () => {
      if (
        window.currentUser?.canLogs ||
        window.currentUser?.role?.toLowerCase() === "admin"
      ) {
        openLogs();
      } else {
        alert("Log yetkiniz yok.");
      }
    });
  }

  if (menuLogs) {
    menuLogs.addEventListener("click", () => {
      if (
        window.currentUser?.canLogs ||
        window.currentUser?.role?.toLowerCase() === "admin"
      ) {
        openLogs();
      } else {
        alert("Log yetkiniz yok.");
      }
    });
  }

  if (btnCloseLogs) btnCloseLogs.addEventListener("click", closeLogs);

  if (logsBack) {
    logsBack.addEventListener("click", () => {
      closeLogs();
      if (typeof goHome === "function") goHome();
      else {
        const homeView = document.getElementById("homeView");
        if (homeView) homeView.style.display = "block";
      }
    });
  }

  if (logSearch)
    logSearch.addEventListener("input", () =>
      renderLogs(window.currentLogs || [])
    );

  if (btnClearLogs) {
    btnClearLogs.addEventListener("click", async () => {
      if (!confirm("Tüm loglar silinsin mi?")) return;

      try {
        const res = await authorizedFetch(`${API_URL}/logs/clear`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error(await res.text());
        alert("Tüm loglar temizlendi.");
        await loadLogs();
      } catch (err) {
        console.error("🚨 Clear logs error:", err);
        alert("Loglar temizlenemedi.");
      }
    });
  }

  window.addEventListener("userChanged", () => {
    if (!window.currentUser) {
      logList.innerHTML = `<li class="log-empty">Giriş yapılmadı.</li>`;
      closeLogs();
    }
  });
});

// ✅ login sonrası log butonlarını yeniden etkinleştir
window.addEventListener("userChanged", () => {
  const btnLogs = document.getElementById("btnLogs");
  const menuLogs = document.getElementById("menuLogs");
  const logPanel = document.getElementById("logPanel");

  if (window.currentUser) {
    if (btnLogs) {
      btnLogs.onclick = () => {
        if (
          window.currentUser.canLogs ||
          window.currentUser.role?.toLowerCase() === "admin"
        ) {
          logPanel.style.display = "flex";
          // loadLogs() DOMContentLoaded içinde tanımlandığı için erişim mümkün değilse yeniden çağır:
          if (typeof loadLogs === "function") loadLogs();
          else if (typeof window.loadLogs === "function") window.loadLogs();
        } else {
          alert("Log yetkiniz yok.");
        }
      };
    }

    if (menuLogs) {
      menuLogs.onclick = () => {
        if (
          window.currentUser.canLogs ||
          window.currentUser.role?.toLowerCase() === "admin"
        ) {
          logPanel.style.display = "flex";
          if (typeof loadLogs === "function") loadLogs();
          else window.dispatchEvent(new Event("loadLogs"));
        } else {
          alert("Log yetkiniz yok.");
        }
      };
    }
  } else {
    // çıkış yapılınca log panelini otomatik kapat
    if (logPanel) logPanel.style.display = "none";
  }
});
