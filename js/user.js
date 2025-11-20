document.addEventListener("DOMContentLoaded", () => {
  const userPanel = document.getElementById("userPanel");
  const userListBody = document.getElementById("userListBody");
  const btnUserMgmt = document.getElementById("btnUserMgmt");

  let editingUserId = null;

  const roleMap = { Admin: "1", Constructor: "2", Viewer: "3" };
  const roleLabelMap = { 1: "Admin", 2: "Constructor", 3: "Viewer" };

  const formUsername = document
    .getElementById("userFormFields")
    .querySelector("input[name='username']");
  const formPassword = document
    .getElementById("userFormFields")
    .querySelector("input[name='password']");
  const formRole = document
    .getElementById("userFormFields")
    .querySelector("select[name='role']");

  // ✅ Bunları değiştirdik:
  const chkInventory = document.querySelector("input[name='canInventory']");
  const chkLogs = document.querySelector("input[name='canLogs']");
  const chkUsers = document.querySelector("input[name='canUsers']");

  const btnSaveUser = document.getElementById("btnSaveUser");
  const btnResetUserForm = document.getElementById("btnResetUserForm");

  btnUserMgmt.addEventListener("click", async () => {
    await loadUsers();
    userPanel.style.display = "flex";
    resetUserForm();
    initPermToggles();
  });

  // ✅ Sağ üst menüdeki Kullanıcı Yönetimi menü butonu da aynı işlemi yapsın
  document.getElementById("menuUsers")?.addEventListener("click", async () => {
    await loadUsers();
    userPanel.style.display = "flex";
    document.getElementById("homeView").style.display = "block"; // ana sayfa görünür kalır (arka plan)
    resetUserForm();
    initPermToggles();
  });

  document.getElementById("closeUserPanel").addEventListener("click", () => {
    userPanel.style.display = "none";
    document.getElementById("homeView").style.display = "block"; // ✅ ana sayfayı geri getir
  });

  document.getElementById("userBack").addEventListener("click", () => {
    userPanel.style.display = "none";
    document.getElementById("homeView").style.display = "block";
  });

  async function loadUsers() {
    try {
      const filter = document.getElementById("userFilter")?.value || "active";

      const res = await authorizedFetch(`${API_URL}/user?filter=${filter}`);
      if (!res.ok) {
        const err = await res.text();
        alert("Kullanıcılar alınamadı: " + err);
        return;
      }
      const users = await res.json();
      renderUserList(users);
    } catch (err) {
      console.error("loadUsers error:", err);
      alert("Sunucuya bağlanılamadı.");
    }
  }

  document
    .getElementById("userFilter")
    ?.addEventListener("change", async () => {
      await loadUsers();
    });

  function renderUserList(users) {
    userListBody.innerHTML = "";

    const roleMap = {
      1: "Admin",
      2: "Constructor",
      3: "Viewer",
      Admin: "Admin",
      Constructor: "Constructor",
      Viewer: "Viewer",
    };

    users.forEach((u) => {
      const tr = document.createElement("tr");

      if (!u.isActive) tr.classList.add("inactive-row");

      tr.innerHTML = `
      <td>${u.username}</td>
      <td>${roleMap[u.role] || "-"}</td>
      <td>
        ${u.canInventory ? "Envanter " : ""}
        ${u.canLogs ? "Loglar " : ""}
        ${u.canUsers ? "Kullanıcı " : ""}
      </td>
      <td>
        <div class="user-actions">

          ${
            u.isActive
              ? `
                <!-- 🔵 Düzenle -->
                <button class="icon-btn edit" data-id="${u.id}" data-action="edit" title="Düzenle">
                  <img src="images/edit.png"/>
                </button>

                <!-- 🔴 Sil -->
                <button class="icon-btn danger" data-id="${u.id}" data-action="passive" title="Sil">
                  <img src="images/trash.png"/>
                </button>
              `
              : `
                <!-- ♻️ Geri Yükle -->
                <button class="icon-btn restore" data-id="${u.id}" data-action="restore" title="Geri Yükle">
                  <img src="images/reset.png"/>
                </button>
              `
          }

        </div>
      </td>
    `;

      userListBody.appendChild(tr);
    });

    // --- EVENTLER ---
    userListBody
      .querySelectorAll("button[data-action='passive']")
      .forEach((btn) =>
        btn.addEventListener("click", () => passiveUser(btn.dataset.id))
      );

    userListBody
      .querySelectorAll("button[data-action='restore']")
      .forEach((btn) =>
        btn.addEventListener("click", () => restoreUser(btn.dataset.id))
      );

    userListBody
      .querySelectorAll("button[data-action='edit']")
      .forEach((btn) =>
        btn.addEventListener("click", () => editUser(btn.dataset.id))
      );
  }

  async function passiveUser(id) {
    if (!confirm("Kullanıcı pasife alınsın mı?")) return;

    try {
      const res = await authorizedFetch(`${API_URL}/user/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const err = await res.text();
        alert("İşlem başarısız: " + err);
        return;
      }

      alert("Kullanıcı pasife alındı.");
      await loadUsers();
    } catch (e) {
      alert("Sunucu hatası.");
    }
  }

  async function restoreUser(id) {
    if (!confirm("Kullanıcı tekrar aktif hale getirilsin mi?")) return;

    try {
      const res = await authorizedFetch(`${API_URL}/user/${id}/restore`, {
        method: "PATCH",
      });

      if (!res.ok) {
        const err = await res.text();
        alert("İşlem başarısız: " + err);
        return;
      }

      alert("Kullanıcı aktifleştirildi.");
      await loadUsers();
    } catch (err) {
      alert("Sunucu hatası.");
    }
  }

  async function editUser(id) {
    try {
      const res = await authorizedFetch(`${API_URL}/user`);
      const users = await res.json();
      const user = users.find((u) => u.id == id);

      if (!user) return;

      editingUserId = id;
      formUsername.value = user.username;
      formPassword.value = "";

      // 🔹 Rol değerini hem string hem int için kontrol et
      if (user.role == "Admin" || user.role == 1) {
        formRole.value = "1";
      } else if (user.role == "Constructor" || user.role == 2) {
        formRole.value = "2";
      } else {
        formRole.value = "3";
      }

      chkInventory.checked = user.canInventory;
      chkLogs.checked = user.canLogs;
      chkUsers.checked = user.canUsers;

      btnSaveUser.textContent = "Kullanıcı Güncelle";

      // 🔹 Admin ise yetkiler otomatik aktif + disabled
      if (user.role == "Admin" || user.role == 1) {
        chkInventory.checked = true;
        chkLogs.checked = true;
        chkUsers.checked = true;

        chkInventory.disabled = true;
        chkLogs.disabled = true;
        chkUsers.disabled = true;
        document.querySelector(".perms-block").classList.add("disabled-perms");
      } else {
        chkInventory.disabled = false;
        chkLogs.disabled = false;
        chkUsers.disabled = false;

        // 🔹 Eğer daha önce eklenmişse kaldır
        document
          .querySelector(".perms-block")
          .classList.remove("disabled-perms");
      }

      initPermToggles();
    } catch (err) {
      console.error("editUser error:", err);
    }
  }

  function resetUserForm() {
    editingUserId = null;
    formUsername.value = "";
    formPassword.value = "";
    formRole.value = "3";
    chkInventory.checked = false;
    chkLogs.checked = false;
    chkUsers.checked = false;
    btnSaveUser.textContent = "Kullanıcı Kaydet";
    chkInventory.disabled = false;
    chkLogs.disabled = false;
    chkUsers.disabled = false;
    document.querySelector(".perms-block").classList.remove("disabled-perms");

    initPermToggles();
  }

  btnResetUserForm.addEventListener("click", resetUserForm);

  btnSaveUser.addEventListener("click", async () => {
    const dto = {
      username: formUsername.value.trim(),
      password: formPassword.value.trim(),
      role: parseInt(formRole.value),
      canInventory: chkInventory.checked,
      canLogs: chkLogs.checked,
      canUsers: chkUsers.checked,
    };

    if (!dto.username) {
      alert("Kullanıcı adı zorunlu.");
      return;
    }

    try {
      let res;
      if (editingUserId) {
        res = await authorizedFetch(`${API_URL}/user/${editingUserId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dto),
        });
      } else {
        res = await authorizedFetch(`${API_URL}/user/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dto),
        });
      }

      if (!res.ok) {
        const err = await res.text();
        alert("İşlem başarısız: " + err);
        return;
      }

      alert(editingUserId ? "Kullanıcı güncellendi." : "Kullanıcı eklendi.");
      resetUserForm();
      await loadUsers();
    } catch (err) {
      console.error("saveUser error:", err);
      alert("Sunucuya bağlanılamadı.");
    }
  });

  formRole.addEventListener("change", () => {
    if (formRole.value === "1") {
      chkInventory.checked = true;
      chkLogs.checked = true;
      chkUsers.checked = true;

      chkInventory.disabled = true;
      chkLogs.disabled = true;
      chkUsers.disabled = true;
    } else {
      chkInventory.disabled = false;
      chkLogs.disabled = false;
      chkUsers.disabled = false;
    }
    initPermToggles();
  });

  function initPermToggles() {
    document.querySelectorAll(".perm-item").forEach((item) => {
      const checkbox = item.querySelector("input[type=checkbox]");
      function sync() {
        item.dataset.checked = checkbox.checked ? "true" : "false";
      }
      checkbox.addEventListener("change", sync);
      sync();
    });
  }

  function enforceUserPermissions() {
    if (!window.currentUser) return;
    const role = window.currentUser.role?.toLowerCase();

    if (role === "admin") {
      btnSaveUser.disabled = false;
      btnResetUserForm.disabled = false;
      return;
    }

    document.getElementById("btnUserMgmt").style.display = "none";
    document.getElementById("menuUsers").style.display = "none";
    userPanel.style.display = "none";
  }

  enforceUserPermissions();
});
