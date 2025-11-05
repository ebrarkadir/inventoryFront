

document.getElementById("pwToggle").addEventListener("click", () => {
  const pwInput = document.getElementById("loginPass");
  const btn = document.getElementById("pwToggle");
  if (pwInput.type === "password") {
    pwInput.type = "text";
    btn.textContent = "Gizle";
  } else {
    pwInput.type = "password";
    btn.textContent = "Göster";
  }
});

document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("loginForm");
  const statusEl = document.getElementById("loginStatus");
  const chipName = document.getElementById("chipName");
  const chipRole = document.getElementById("chipRole");
  const userChip = document.getElementById("userChip");
  const userMenu = document.getElementById("userMenu");
  const userPanel = document.getElementById("userPanel");

  function notifyUserChanged() {
    window.dispatchEvent(new Event("userChanged"));
  }

  function enforcePermissions() {
    if (!window.currentUser) return;
    const role = window.currentUser.role?.toLowerCase();

    if (role === "viewer") {
      document.getElementById("panelForm").style.display = "none";
      document.getElementById("panelList").style.display = "";
      const wrapper = document.querySelector(".inventory-wrapper");
      if (wrapper) wrapper.classList.add("viewer-mode");

      document.getElementById("btnExport").style.display = "none";
      document.getElementById("btnImport").style.display = "none";
    } else {
      const wrapper = document.querySelector(".inventory-wrapper");
      if (wrapper) wrapper.classList.remove("viewer-mode");
      document.getElementById("btnExport").style.display = "";
      document.getElementById("btnImport").style.display = "";
    }

    if (role === "admin") return;

    if (!window.currentUser.canLogs) {
      document.getElementById("btnLogs").style.display = "none";
      document.getElementById("menuLogs").style.display = "none";
    }

    if (!window.currentUser.canUsers) {
      document.getElementById("btnUserMgmt").style.display = "none";
      document.getElementById("menuUsers").style.display = "none";
    }
  }

  function resetUI() {
    document.getElementById("btnUserMgmt").style.display = "";
    document.getElementById("menuUsers").style.display = "";
    document.getElementById("btnLogs").style.display = "";
    document.getElementById("menuLogs").style.display = "";
    document.getElementById("panelForm").style.display = "";
    document.getElementById("panelList").style.display = "";

    const wrapper = document.querySelector(".inventory-wrapper");
    if (wrapper) wrapper.classList.remove("viewer-mode");
  }

  const stored = localStorage.getItem("currentUser");
  if (stored) {
    const u = JSON.parse(stored);
    chipName.textContent = u.username || "-";
    chipRole.textContent = u.role || "-";
    window.currentUser = u;
    resetUI();
    enforcePermissions();

    document.getElementById("loginShell").style.display = "none";
    document.getElementById("appShell").style.display = "flex";

    notifyUserChanged();
  }

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = document.getElementById("loginUser").value.trim();
    const password = document.getElementById("loginPass").value.trim();
    if (!username || !password) {
      statusEl.textContent = "Kullanıcı adı ve şifre zorunludur.";
      return;
    }

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!response.ok) {
        const err = await response.text();
        statusEl.textContent = "Giriş başarısız: " + err;
        return;
      }
      const data = await response.json();
      localStorage.setItem("accessToken", data.token);
      localStorage.setItem("refreshToken", data.refreshToken);

      const userObj = {
        id: data.id,
        username: data.username,
        role: data.role,
        canInventory: data.canInventory,
        canLogs: data.canLogs,
        canUsers: data.canUsers,
      };
      localStorage.setItem("currentUser", JSON.stringify(userObj));
      window.currentUser = userObj;

      resetUI();
      enforcePermissions();

      chipName.textContent = userObj.username;
      chipRole.textContent = userObj.role;
      document.getElementById("loginShell").style.display = "none";
      document.getElementById("appShell").style.display = "flex";

      notifyUserChanged();
    } catch (error) {
      console.error("Login error:", error);
      statusEl.textContent = "Sunucuya bağlanılamadı.";
    }
  });

  document.getElementById("menuLogout").addEventListener("click", () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("currentUser");
    window.currentUser = null;

    document.getElementById("appShell").style.display = "none";
    document.getElementById("loginShell").style.display = "flex";
    loginForm.reset();

    notifyUserChanged();
  });

  userChip.addEventListener("click", (e) => {
    userMenu.classList.toggle("hidden");
    e.stopPropagation();
  });

  document.addEventListener("click", (e) => {
    if (!userMenu.classList.contains("hidden")) {
      if (!userMenu.contains(e.target) && !userChip.contains(e.target)) {
        userMenu.classList.add("hidden");
      }
    }
  });

  document.getElementById("menuUsers").addEventListener("click", () => {
    userMenu.classList.add("hidden");
    document.getElementById("homeView").style.display = "none";
    userPanel.style.display = "flex";
  });
});

// ✅ Gelişmiş authorizedFetch (token yenileme + UI reset)
async function authorizedFetch(url, options = {}) {
  let token = localStorage.getItem("accessToken");
  let headers = {
    ...(options.headers || {}),
    ...(token ? { Authorization: "Bearer " + token } : {}), // 🔧 token yoksa ekleme
  };

  let res = await fetch(url, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    const rt = localStorage.getItem("refreshToken");
    if (!rt) return res;

    try {
      const rres = await fetch(`${API_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: rt }),
      });

      if (rres.ok) {
        const data = await rres.json();
        localStorage.setItem("accessToken", data.token);
        token = data.token;

        headers = {
          ...(options.headers || {}),
          Authorization: "Bearer " + token,
        };

        res = await fetch(url, {
          ...options,
          headers,
        });
      } else {
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        localStorage.removeItem("currentUser");
        window.currentUser = null;
        window.dispatchEvent(new Event("userChanged"));

        // 🔧 UI reset eklendi
        document.getElementById("appShell").style.display = "none";
        document.getElementById("loginShell").style.display = "flex";
      }
    } catch (error) {
      console.error("Refresh token error:", error);
      return res;
    }
  }

  return res;
}
