document.addEventListener("DOMContentLoaded", () => {
  const cache = {};

  async function loadDistinctOptions(field, listId) {
    try {
      if (cache[field]) {
        renderComboList(cache[field], field, listId);
        return;
      }
      const res = await authorizedFetch(
        `${API_URL}/inventory/distinct/${field.toLowerCase()}`
      );
      if (!res.ok) return;

      const values = await res.json();
      cache[field] = values;
      renderComboList(values, field, listId);
    } catch (e) {
      console.error(`loadDistinctOptions(${field}) error:`, e);
    }
  }

  function renderComboList(values, field, listId) {
    const listEl = document.getElementById(listId);
    if (!listEl) return;

    window.dropdownCache = window.dropdownCache || {};
    window.dropdownCache[field.toLowerCase()] = values;

    function populateList(filteredValues) {
      listEl.innerHTML = "";

      if (!filteredValues || filteredValues.length === 0) {
        const emptyEl = document.createElement("div");
        emptyEl.className = "combo-empty";
        emptyEl.textContent = "Sonuç bulunamadı";
        listEl.appendChild(emptyEl);
        return;
      }

      filteredValues.forEach((v) => {
        if (!v) return;
        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = v;

        btn.addEventListener("click", (e) => {
          e.stopPropagation();

          const targetInput = document.querySelector(
            `[id^="f_"][id$="${field.toLowerCase()}" i]`
          );
          if (targetInput) {
            targetInput.value = v;
            listEl.classList.remove("open");
          }
        });

        listEl.appendChild(btn);
      });
    }

    populateList(values);

    const fieldLower = field.toLowerCase();
    const targetInput = document.querySelector(
      `[id^="f_"][id$="${fieldLower}" i]`
    );

    const searchableFields = ["brand", "itemname", "itemgroup", "model"];
    if (targetInput && searchableFields.includes(fieldLower)) {
      targetInput.addEventListener("input", (e) => {
        const search = e.target.value.toLowerCase().trim();
        const allValues = window.dropdownCache[fieldLower] || [];
        const filtered = allValues.filter((v) =>
          v?.toLowerCase().includes(search)
        );

        populateList(filtered);

        if (filtered.length > 0) listEl.classList.add("open");
        else listEl.classList.remove("open");
      });

      targetInput.addEventListener("focus", () => {
        const allValues = window.dropdownCache[fieldLower] || [];
        populateList(allValues);
        listEl.classList.add("open");
      });

      document.addEventListener("click", (e) => {
        if (!listEl.contains(e.target) && e.target !== targetInput) {
          listEl.classList.remove("open");
        }
      });
    }
  }

  const formFields = [
    "serialNumber",
    "brand",
    "itemName",
    "itemGroup",
    "model",
    "stockInDate",
    "stockOutDate",
    "description",
    "assignedProject",
    "assignedPerson",
    "status",
    "lastActionDate",
  ];

  const fieldLabels = {
    serialNumber: "Seri No",
    brand: "Marka",
    itemName: "Malzeme Adı",
    itemGroup: "Malzeme Grubu",
    model: "Model",
    stockInDate: "Stok Giriş Tarihi",
    stockOutDate: "Stok Çıkış Tarihi",
    description: "Açıklama",
    assignedProject: "Tahsis Edilen Proje",
    assignedPerson: "Tahsis Edilen Kişi",
    status: "Durum",
    lastActionDate: "Son İşlem Tarihi",
  };

  let editingId = null;

  const btnSave = document.getElementById("btnSave");
  const btnClear = document.getElementById("btnClear");
  const invCount = document.getElementById("invCount");
  const searchBox = document.getElementById("searchBox");
  const invBody = document.getElementById("invBody");
  const invHead = document.getElementById("invHead");

  async function loadInventories() {
    try {
      const filter = document.getElementById("filterActive")?.value || "active";
      let url = `${API_URL}/inventory`;

      if (filter === "inactive" || filter === "all") {
        url += "?includeInactive=true";
      } else {
        url += "?includeInactive=false";
      }

      const res = await authorizedFetch(url);
      if (!res.ok) {
        const err = await res.text();
        alert("Envanter alınamadı: " + err);
        return;
      }

      const data = await res.json();

      let filteredData = data;
      if (filter === "inactive") filteredData = data.filter((d) => !d.isActive);
      else if (filter === "active")
        filteredData = data.filter((d) => d.isActive);

      window.currentData = data; // Tüm veriyi tut
      window.filteredData = filteredData; // Sadece aktif/pasif filtrelenmiş veriyi tut

      renderTable(filteredData);
    } catch (e) {
      console.error("loadInventories error:", e);
      alert("Sunucuya bağlanılamadı.");
    }

    await Promise.all([
      loadDistinctOptions("brand", "brandOptions"),
      loadDistinctOptions("itemname", "itemNameOptions"),
      loadDistinctOptions("itemgroup", "groupOptions"),
      loadDistinctOptions("model", "modelOptions"),
      loadDistinctOptions("assignedproject", "projectOptions"),
      loadDistinctOptions("assignedperson", "personOptions"),
      loadDistinctOptions("status", "statusOptions"),
    ]);
  }

  function collectForm() {
    const dto = {};
    formFields.forEach((f) => {
      const el = document.getElementById("f_" + f);
      dto[f] = el?.value || null;
    });

    dto.status = dto.status ? parseInt(dto.status) : 0;

    return dto;
  }

  function resetForm() {
    editingId = null;
    formFields.forEach((f) => {
      const el = document.getElementById("f_" + f);
      if (el) el.value = "";
    });
    btnSave.textContent = "Kaydet";
  }

  async function saveInventory() {
    const dto = collectForm();
    if (!dto.serialNumber) {
      alert("Seri No zorunlu.");
      return;
    }

    try {
      let res;
      if (editingId) {
        res = await authorizedFetch(`${API_URL}/inventory/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dto),
        });
      } else {
        res = await authorizedFetch(`${API_URL}/inventory`, {
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

      alert(editingId ? "Envanter güncellendi." : "Envanter eklendi.");
      resetForm();
      await loadInventories();
    } catch (e) {
      console.error("saveInventory error:", e);
    }
  }

  async function deleteInventory(id) {
    if (!confirm("Bu kayıt pasif hale getirilsin mi?")) return;
    try {
      const res = await authorizedFetch(`${API_URL}/inventory/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.text();
        alert("Silme başarısız: " + err);
        return;
      }
      alert("Envanter pasif hale getirildi.");

      await loadInventories(); // ✔ tabloyu günceller // ❗ burada başka hiçbir şey OLMAYACAK
    } catch (e) {
      console.error("deleteInventory error:", e);
    }
  }

  async function restoreInventory(id) {
    if (!confirm("Bu kayıt geri yüklensin mi?")) return;
    try {
      const res = await authorizedFetch(`${API_URL}/inventory/${id}/restore`, {
        method: "PATCH",
      });
      if (!res.ok) {
        const err = await res.text();
        alert("Geri yükleme başarısız: " + err);
        return;
      }
      alert("Envanter geri yüklendi.");
      await loadInventories();
    } catch (e) {
      console.error("restoreInventory error:", e);
    }
  }

  async function editInventory(id) {
    try {
      const res = await authorizedFetch(`${API_URL}/inventory/${id}`);
      if (!res.ok) {
        const err = await res.text();
        alert("Kayıt bulunamadı: " + err);
        return;
      }

      const inv = await res.json();
      editingId = inv.id;

      formFields.forEach((f) => {
        const el = document.getElementById("f_" + f);
        if (!el) return;

        let value = inv[f] || "";

        if (
          (f === "stockInDate" ||
            f === "stockOutDate" ||
            f === "lastActionDate") &&
          value
        ) {
          const d = new Date(value);
          value = d.toISOString().split("T")[0];
        }

        if (f === "status" && el.tagName === "SELECT") {
          el.value = inv[f];
        } else {
          el.value = value;
        }

        if (f === "lastActionDate") el.readOnly = true;
      });

      btnSave.textContent = "Güncelle";
    } catch (e) {
      console.error("editInventory error:", e);
    }
  }

  function buildTableHead() {
    invHead.innerHTML = "";
    const tr = document.createElement("tr"); // Çoklu seçim sütunu

    const thBulk = document.createElement("th");
    thBulk.className = "bulk-col hidden";
    thBulk.innerHTML = `<input type="checkbox" id="chkSelectAll">`;
    tr.appendChild(thBulk);

    formFields.forEach((f) => {
      const th = document.createElement("th");
      th.textContent = fieldLabels[f] || f;
      th.style.cursor = "pointer";
      th.dataset.sort = "none"; // 🔹 Başlığa tıklayınca sıralama yap

      th.addEventListener("click", () => {
        const currentSort = th.dataset.sort;
        let newSort; // 🧠 Sıralama döngüsü: none → asc → desc → none

        if (currentSort === "none") newSort = "asc";
        else if (currentSort === "asc") newSort = "desc";
        else newSort = "none";

        th.dataset.sort = newSort; // Diğer başlıkların sort durumlarını sıfırla

        invHead.querySelectorAll("th").forEach((h) => {
          if (h !== th) h.dataset.sort = "none";
        }); // 🧹 Eğer sıralama none olduysa orijinal veriyi geri getir

        if (newSort === "none") {
          renderTable(window.filteredData);
          return;
        } // 🔽 Veriyi sırala

        const sortedData = [...window.filteredData].sort((a, b) => {
          const valA = a[f] ?? "";
          const valB = b[f] ?? "";

          if (typeof valA === "number" && typeof valB === "number") {
            return newSort === "asc" ? valA - valB : valB - valA;
          }

          return newSort === "asc"
            ? String(valA).localeCompare(String(valB), "tr")
            : String(valB).localeCompare(String(valA), "tr");
        });

        renderTable(sortedData);
      });

      tr.appendChild(th);
    });

    const thAction = document.createElement("th");
    thAction.textContent = "İşlem";
    tr.appendChild(thAction);
    invHead.appendChild(tr);

    buildFilterRow();
  }

  async function buildFilterRow() {
    const tr = document.createElement("tr");

    const filterableFields = [
      "serialNumber",
      "brand",
      "itemName",
      "itemGroup",
      "model",
      "assignedProject",
      "assignedPerson",
      "status",
    ];

    for (const f of formFields) {
      const td = document.createElement("td");

      if (!filterableFields.includes(f)) {
        td.innerHTML = `<div class="no-filter">Filtre Yok</div>`;
        tr.appendChild(td);
        continue;
      }

      const wrapper = document.createElement("div");
      wrapper.className = "filter-multi";
      wrapper.style.position = "relative";

      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = "-- Tümü ▼";
      btn.className = "filter-select";
      btn.style.textAlign = "left";

      const dropdown = document.createElement("div");
      dropdown.className = "multi-dropdown";

      wrapper.appendChild(btn);
      wrapper.appendChild(dropdown);
      td.appendChild(wrapper);
      tr.appendChild(td); // 🔹 Distinct değerleri API'den çek

      try {
        const res = await authorizedFetch(
          `${API_URL}/inventory/distinct/${f.toLowerCase()}`
        );
        if (res.ok) {
          const values = await res.json();
          values.filter(Boolean).forEach((v) => {
            const label = document.createElement("label");
            const cb = document.createElement("input");
            cb.type = "checkbox";
            cb.value = v;

            cb.addEventListener("change", () => {
              applyDropdownFilters();
              updateFilterButtonText(btn, dropdown);
            });

            label.appendChild(cb);
            label.append(v);
            dropdown.appendChild(label);
          });
        }
      } catch (e) {
        console.warn(`Distinct yüklenemedi: ${f}`, e);
      }

      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        dropdown.classList.toggle("open");
        if (dropdown.classList.contains("open")) {
          positionFilterDropdown(dropdown);
        }
      });

      document.addEventListener("click", (e) => {
        if (!wrapper.contains(e.target)) dropdown.classList.remove("open");
      });
    } // 🔹 İşlem sütunu boşluğu yerine "Filtreleri Kaldır" butonu // 🔹 İşlem sütunu boşluğu yerine "Filtreleri Kaldır" butonu

    const tdClear = document.createElement("td");
    tdClear.style.textAlign = "center";

    const clearBtn = document.createElement("button");
    clearBtn.textContent = "Filtreleri Kaldır";
    clearBtn.className = "outline clear-filters-btn";
    clearBtn.style.padding = "4px 8px";
    clearBtn.style.fontSize = "12px"; // 🔹 Yazı boyutu küçültüldü
    clearBtn.style.borderRadius = "6px";
    clearBtn.style.cursor = "pointer";
    clearBtn.style.background = "transparent";
    clearBtn.style.border = "1px solid var(--brand1)";
    clearBtn.style.color = "var(--brand1)";
    clearBtn.style.transition = "0.25s";

    clearBtn.addEventListener("mouseenter", () => {
      clearBtn.style.background = "var(--brand1)";
      clearBtn.style.color = "#fff";
    });
    clearBtn.addEventListener("mouseleave", () => {
      clearBtn.style.background = "transparent";
      clearBtn.style.color = "var(--brand1)";
    });

    clearBtn.addEventListener("click", () => {
      // 🔸 Tüm checkbox'ları temizle
      document
        .querySelectorAll(".filter-multi input[type='checkbox']")
        .forEach((cb) => (cb.checked = false)); // 🔸 Tüm buton metinlerini sıfırla

      document.querySelectorAll(".filter-select").forEach((b) => {
        b.textContent = "-- Tümü ▼";
      }); // 🔸 Tabloyu sıfırla

      renderTable(window.filteredData);
    });

    tdClear.appendChild(clearBtn);
    tr.appendChild(tdClear);

    invHead.appendChild(tr);
  } // 🔹 Dropdown konumunu dinamik belirle (yukarı/aşağı)

  function positionFilterDropdown(dropdown) {
    const btn = dropdown.previousElementSibling;
    const container = document.querySelector(".table-container");
    if (!btn || !container) return;

    const cRect = container.getBoundingClientRect();
    const bRect = btn.getBoundingClientRect();

    const dropHeight = Math.min(dropdown.scrollHeight || 220, 220) + 12;

    const spaceBelow = cRect.bottom - bRect.bottom;
    const spaceAbove = bRect.top - cRect.top; // YUKARI AÇILMA kontrolü

    dropdown.classList.toggle(
      "open-up",
      spaceBelow < dropHeight && spaceAbove > spaceBelow
    ); // SAĞA taşma kontrolü

    const dRect = dropdown.getBoundingClientRect();
    const overflowRight = dRect.right - cRect.right;
    const overflowLeft = cRect.left - dRect.left;
    dropdown.classList.toggle(
      "align-right",
      overflowRight > 0 && overflowRight > overflowLeft
    );
  }

  function updateFilterButtonText(btn, dropdown) {
    const checked = dropdown.querySelectorAll("input[type='checkbox']:checked");
    if (checked.length === 0) {
      btn.textContent = "-- Tümü ▼";
    } else if (checked.length === 1) {
      btn.textContent = checked[0].value;
    } else {
      btn.textContent = `${checked.length} Seçili`;
    }
  }

  function applyDropdownFilters() {
    const filters = {}; // 🔹 Her dropdown içindeki seçili checkbox’ları topla

    document.querySelectorAll(".filter-multi").forEach((fm) => {
      const fieldIndex = fm.closest("td").cellIndex;
      const field = Object.keys(fieldLabels)[fieldIndex];
      const selected = Array.from(
        fm.querySelectorAll("input[type='checkbox']:checked")
      ).map((cb) => cb.value);
      if (selected.length > 0) filters[field] = selected;
    });

    if (Object.keys(filters).length === 0) {
      renderTable(window.filteredData);
      return;
    }

    const filtered = window.filteredData.filter((item) => {
      return Object.entries(filters).every(([f, values]) => {
        const rawVal = item[f];
        if (rawVal == null) return false; // 🔹 Status için özel eşleştirme

        if (f.toLowerCase() === "status") {
          const label = getStatusLabel(rawVal).toLowerCase();
          return values.some((v) => {
            const valLower = v.toLowerCase(); // Eğer cb.value sayısal ya da metin olabilir — ikisini de kontrol et
            return (
              label.includes(valLower) ||
              getStatusLabel(v)?.toLowerCase() === label ||
              v == rawVal.toString()
            );
          });
        } // 🔹 Diğer alanlar

        const itemVal = rawVal.toString().toLowerCase();
        return values.some((v) => itemVal.includes(v.toLowerCase()));
      });
    });

    renderTable(filtered);
  }

  let currentPage = 1;
  const pageSize = 5;
  let allRows = [];

  function deepSearch(obj, term) {
    const lowerTerm = term.toLowerCase();

    for (const key in obj) {
      const value = obj[key];
      if (value == null) continue;

      if (typeof value === "string" && !isNaN(Date.parse(value))) {
        const dateStr = new Date(value).toLocaleDateString("tr-TR");
        if (dateStr.toLowerCase().includes(lowerTerm)) return true;
      }

      if (typeof value === "object") {
        if (deepSearch(value, term)) return true;
      }

      if (key === "status") {
        const statusLabel = getStatusLabel(value).toLowerCase();
        if (
          statusLabel.includes(lowerTerm) ||
          value.toString().includes(lowerTerm)
        )
          return true;
      }

      if (value.toString().toLowerCase().includes(lowerTerm)) return true;
    }

    return false;
  }

  function renderTable(data) {
    invBody.innerHTML = "";
    const q = searchBox.value.toLowerCase().trim();
    let filtered = data; // 💡 Arama yapıldığında sayfayı sıfırla

    if (q) {
      filtered = data.filter((d) => deepSearch(d, q));
      currentPage = 1;
    }

    invCount.textContent = filtered.length;
    allRows = [];

    if (filtered.length === 0) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = formFields.length + 1;
      td.textContent = "Kayıt bulunamadı.";
      td.style.textAlign = "center";
      td.style.padding = "20px";
      td.style.color = "#6b7280";
      tr.appendChild(td);
      invBody.appendChild(tr);

      document.getElementById("pageInfo").textContent = "";
      const summaryEl = document.getElementById("pageSummary");
      if (summaryEl) summaryEl.textContent = "Filtreye uygun kayıt bulunamadı.";

      return;
    }

    filtered.forEach((it) => {
      const tr = document.createElement("tr"); // Çoklu seçim hücresi: bulkMode değişkenine göre dinamik sınıf ataması
      const tdBulk = document.createElement("td");
      tdBulk.className = bulkMode ? "bulk-col" : "bulk-col hidden";
      tdBulk.innerHTML = `<input type="checkbox" class="chkBulk" value="${it.id}">`;
      tr.appendChild(tdBulk);

      if (!it.isActive) tr.classList.add("inactive-row");

      formFields.forEach((f) => {
        const td = document.createElement("td");
        let value = it[f] ?? "";

        if (f === "description") {
          const full = value || "";
          const short = full.length > 40 ? full.substring(0, 40) : full;

          td.innerHTML = `
    <div class="desc-short">
      ${short}${full.length > 40 ? "..." : ""}
      ${
            full.length > 40
              ? `<span class="desc-more" data-full="${full.replace(
                  /"/g,
                  "&quot;"
                )}"> ...Devamını Gör</span>`
              : ""
          }
    </div>
  `;
          tr.appendChild(td);
          return;
        }

        if (
          f === "stockInDate" ||
          f === "stockOutDate" ||
          f === "lastActionDate"
        ) {
          if (value) {
            const d = new Date(value);
            value = d.toLocaleDateString("tr-TR");
          }
        }

        if (f === "status") {
          const s =
            it.status !== undefined && it.status !== null ? it.status : -1;
          value = getStatusLabel(s);
        }

        td.textContent = value;
        tr.appendChild(td);
      });

      const tdAction = document.createElement("td");
      const role = window.currentUser?.role?.toLowerCase(); // 🔹 DÜZENLE

      if (role === "admin" || role === "constructor") {
        const be = document.createElement("button");
        be.className = "icon-btn outline edit";
        be.title = "Düzenle";
        be.innerHTML = `<img src="images/edit.png" alt="Düzenle">`;
        be.addEventListener("click", () => editInventory(it.id));
        tdAction.appendChild(be);
      } // 🔹 SİL veya GERİ YÜKLE

      if (role === "admin") {
        const bd = document.createElement("button");
        bd.className = "icon-btn";
        if (it.isActive) {
          bd.classList.add("danger");
          bd.title = "Sil";
          bd.innerHTML = `<img src="images/trash.png" alt="Sil">`;
        } else {
          bd.classList.add("restore");
          bd.title = "Geri Yükle";
          bd.innerHTML = `<img src="images/reset.png" alt="Geri Yükle">`;
        }
        bd.addEventListener("click", () =>
          it.isActive ? deleteInventory(it.id) : restoreInventory(it.id)
        );
        tdAction.appendChild(bd);
      } // 🔹 TARİHÇE

      const bh = document.createElement("button");
      bh.className = "icon-btn outline";
      bh.title = "Tarihçe";
      bh.innerHTML = `<img src="images/history.png" alt="Tarihçe">`;
      bh.addEventListener("click", () => viewHistory(it.id));
      tdAction.appendChild(bh);

      tr.appendChild(tdAction);
      allRows.push(tr);
    });
    renderTablePage();
    bindSelectAllEvent();
  }

  function bindSelectAllEvent() {
    const chkAll = document.getElementById("chkSelectAll");
    if (!chkAll) return;

    chkAll.onchange = () => {
      const checked = chkAll.checked;

      allRows.forEach((row) => {
        const cb = row.querySelector(".chkBulk");
        if (cb) cb.checked = checked;
      });

      renderTablePage();
    };
  }

  function renderTablePage() {
    invBody.innerHTML = "";
    const total = allRows.length;
    const start = (currentPage - 1) * pageSize;
    const end = Math.min(start + pageSize, total);
    const rowsToShow = allRows.slice(start, end);

    rowsToShow.forEach((row) => invBody.appendChild(row));

    document.getElementById(
      "pageInfo"
    ).textContent = `Sayfa ${currentPage} / ${Math.max(
      1,
      Math.ceil(total / pageSize)
    )}`;

    const summaryEl = document.getElementById("pageSummary");
    if (summaryEl) {
      summaryEl.textContent =
        total > 0
          ? `${total} kayıttan ${start + 1}–${end} arası görüntüleniyor`
          : "Kayıt bulunamadı.";
    }

    const container = document.querySelector(".table-container");
    if (container) container.scrollTop = 0;
  }

  document.getElementById("prevPage").addEventListener("click", () => {
    if (currentPage > 1) {
      currentPage--;
      renderTablePage();
    }
  });

  document.getElementById("nextPage").addEventListener("click", () => {
    if (currentPage < Math.ceil(allRows.length / pageSize)) {
      currentPage++;
      renderTablePage();
    }
  });

  btnSave.addEventListener("click", saveInventory);
  btnClear.addEventListener("click", resetForm);
  searchBox.addEventListener("input", () =>
    renderTable(window.filteredData || [])
  );

  document
    .getElementById("filterActive")
    .addEventListener("change", loadInventories);

  document.querySelectorAll(".combo-drop").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const field = btn.dataset.field;
      const list = btn.parentElement.querySelector(".combo-list");
      if (list.classList.contains("open")) {
        list.classList.remove("open");
      } else {
        await loadDistinctOptions(field, field + "Options");
        list.classList.add("open");
      }
    });
  });

  document.addEventListener("click", (e) => {
    document.querySelectorAll(".combo-list.open").forEach((l) => {
      if (!l.contains(e.target) && !l.parentNode.contains(e.target)) {
        l.classList.remove("open");
      }
    });
  });

  document.getElementById("btnExport").addEventListener("click", async () => {
    try {
      const filterValue =
        document.getElementById("filterActive")?.value?.toLowerCase() ||
        "active";

      const exportUrl = `${API_URL}/inventory/export-file?filter=${encodeURIComponent(
        filterValue
      )}`;

      const res = await authorizedFetch(exportUrl);

      if (!res.ok) {
        alert("Dışa aktarma başarısız!");
        return;
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Envanter_${filterValue}_${
        new Date().toISOString().split("T")[0]
      }.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Export error:", e);
      alert("Hata oluştu.");
    }
  });

  const importFile = document.getElementById("importFile");
  document.getElementById("btnImport").addEventListener("click", () => {
    importFile.click();
  });

  importFile.addEventListener("change", async () => {
    const file = importFile.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await authorizedFetch(`${API_URL}/inventory/import`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.text();
        alert("İçe aktarma başarısız: " + err);
        return;
      }
      const result = await res.json();
      alert(result.message);
      await loadInventories();
    } catch (e) {
      console.error("Import error:", e);
      alert("Hata oluştu.");
    } finally {
      importFile.value = "";
    }
  });

  buildTableHead(); // 🔹 Filtre dropdown pozisyonlarını güncel tut

  const tableContainer = document.querySelector(".table-container");

  if (tableContainer) {
    // Scroll olunca açık dropdown’ların pozisyonunu düzelt
    tableContainer.addEventListener("scroll", () => {
      document
        .querySelectorAll(".multi-dropdown.open")
        .forEach((d) => positionFilterDropdown(d));
    });
  } // Pencere yeniden boyutlandığında da konumu düzelt

  window.addEventListener("resize", () => {
    document
      .querySelectorAll(".multi-dropdown.open")
      .forEach((d) => positionFilterDropdown(d));
  });

  window.addEventListener("userChanged", () => {
    if (window.currentUser) loadInventories();
    else {
      invBody.innerHTML = "";
      invCount.textContent = "0";
    }
  }); // ----------------------------- // 📌 Çoklu Silme Modu // -----------------------------

  let bulkMode = false;

  const bulkModeBtn = document.getElementById("bulkModeBtn");
  const bulkDeleteBtn = document.getElementById("bulkDeleteBtn");
  const bulkCancelBtn = document.getElementById("bulkCancelBtn");
  const bulkRestoreBtn = document.getElementById("bulkRestoreBtn"); // 💡 YENİ BUTON REFERANSLARI

  const btnDeleteAllActive = document.getElementById("btnDeleteAllActive");
  const btnRestoreAllInactive = document.getElementById(
    "btnRestoreAllInactive"
  );

  bulkModeBtn?.addEventListener("click", () => {
    bulkMode = true;

    document
      .querySelectorAll(".bulk-col")
      .forEach((x) => x.classList.remove("hidden"));
    bulkDeleteBtn?.classList.remove("hidden");
    bulkCancelBtn?.classList.remove("hidden");
    bulkModeBtn?.classList.add("hidden");
    bulkRestoreBtn?.classList.remove("hidden");
  });

  bulkCancelBtn?.addEventListener("click", () => {
    bulkMode = false;

    document
      .querySelectorAll(".bulk-col")
      .forEach((x) => x.classList.add("hidden"));

    bulkDeleteBtn?.classList.add("hidden");
    bulkCancelBtn?.classList.add("hidden");
    bulkRestoreBtn?.classList.add("hidden");

    bulkModeBtn?.classList.remove("hidden");

    document.querySelectorAll(".chkBulk").forEach((cb) => (cb.checked = false));
    const all = document.getElementById("chkSelectAll");
    if (all) all.checked = false;
  });

  bulkDeleteBtn?.addEventListener("click", async () => {
    const selectedIds = [...document.querySelectorAll(".chkBulk:checked")].map(
      (x) => x.value
    );

    if (selectedIds.length === 0) {
      alert("Hiçbir kayıt seçilmedi!");
      return;
    } // Durum kontrolü: Pasif olanları engelle

    const selectedItems = (window.currentData || []).filter((item) =>
      selectedIds.includes(item.id.toString())
    );
    const inactiveCount = selectedItems.filter((item) => !item.isActive).length;

    if (inactiveCount > 0) {
      alert(
        `${inactiveCount} adet kayıt zaten pasif durumda. Lütfen sadece aktif kayıtları pasife alın.`
      );
      return;
    }

    if (
      !confirm(
        `${selectedIds.length} aktif kayıt pasife alınacak. Onaylıyor musun?`
      )
    )
      return;

    for (const id of selectedIds) {
      await authorizedFetch(`${API_URL}/inventory/${id}`, {
        method: "DELETE",
      });
    }

    alert("Seçilen kayıtlar pasif hale getirildi.");

    await loadInventories();
    bulkCancelBtn?.click();
  });

  bulkRestoreBtn?.addEventListener("click", async () => {
    const selectedIds = [...document.querySelectorAll(".chkBulk:checked")].map(
      (x) => x.value
    );

    if (selectedIds.length === 0) {
      alert("Hiçbir kayıt seçilmedi!");
      return;
    } // Durum kontrolü: Aktif olanları engelle

    const selectedItems = (window.currentData || []).filter((item) =>
      selectedIds.includes(item.id.toString())
    );
    const activeCount = selectedItems.filter((item) => item.isActive).length;

    if (activeCount > 0) {
      alert(
        `${activeCount} adet kayıt zaten aktif durumda. Lütfen sadece pasif kayıtları geri yükleyin.`
      );
      return;
    }

    if (
      !confirm(
        `${selectedIds.length} pasif kayıt geri yüklenecek. Onaylıyor musun?`
      )
    )
      return;

    for (const id of selectedIds) {
      const res = await authorizedFetch(`${API_URL}/inventory/${id}/restore`, {
        method: "PATCH",
      });

      if (!res.ok) {
        const err = await res.text();
        console.error("Bulk restore error:", err);
      }
    }

    alert("Seçilen kayıtlar geri yüklendi.");

    await loadInventories();
    bulkCancelBtn?.click();
  });

  // 💡 YENİ EKLEME (2): TÜM AKTİFLERİ SİLME İŞLEMİ (Sayfalama Dışı)
  // 💡 GÜNCELLENMİŞ EKLEME: TÜM AKTİFLERİ SİLME İŞLEMİ (Looping)
  btnDeleteAllActive?.addEventListener("click", async () => {
    const role = window.currentUser?.role?.toLowerCase();
    if (role !== "admin") {
      alert("Bu işlemi yapmaya yetkiniz yok.");
      return;
    }

    // Yalnızca aktif kayıtların ID'lerini topla
    const activeItems = (window.currentData || []).filter((d) => d.isActive);
    const activeCount = activeItems.length;

    if (activeCount === 0) {
      alert("Silinecek aktif kayıt bulunmamaktadır.");
      return;
    }

    if (
      !confirm(
        `Tüm tablodaki ${activeCount} adet aktif kayıt pasif hale getirilecek. Bu işlem geri alınamaz. Onaylıyor musun?`
      )
    )
      return;

    let successCount = 0;

    // Her bir aktif öğe için tekil DELETE çağrısı yap
    for (const item of activeItems) {
      try {
        // ÇALIŞAN TEKİL URL'i kullan: DELETE /inventory/{id}
        const res = await authorizedFetch(`${API_URL}/inventory/${item.id}`, {
          method: "DELETE",
        });
        if (res.ok) {
          successCount++;
        } else {
          console.error(
            `Pasif yapma hatası ID ${item.id}: ${await res.text()}`
          );
        }
      } catch (e) {
        console.error(`Fetch hatası ID ${item.id}:`, e);
      }
    }

    if (successCount > 0) {
      alert(`${successCount} adet aktif kayıt başarıyla pasif hale getirildi.`);
    } else {
      alert("Tüm aktif kayıtlar pasif hale getirilirken hata oluştu.");
    }
    await loadInventories();
  });

  // 💡 YENİ EKLEME (3): TÜM PASİFLERİ GERİ YÜKLEME İŞLEMİ (Sayfalama Dışı)
  // 💡 GÜNCELLENMİŞ EKLEME: TÜM PASİFLERİ GERİ YÜKLEME İŞLEMİ (Looping)
  btnRestoreAllInactive?.addEventListener("click", async () => {
    const role = window.currentUser?.role?.toLowerCase();
    if (role !== "admin") {
      alert("Bu işlemi yapmaya yetkiniz yok.");
      return;
    }

    // Yalnızca pasif kayıtların ID'lerini topla
    const inactiveItems = (window.currentData || []).filter((d) => !d.isActive);
    const inactiveCount = inactiveItems.length;

    if (inactiveCount === 0) {
      alert("Geri yüklenecek pasif kayıt bulunmamaktadır.");
      return;
    }

    if (
      !confirm(
        `Tüm tablodaki ${inactiveCount} adet pasif kayıt geri yüklenecek. Onaylıyor musun?`
      )
    )
      return;

    let successCount = 0;

    // Her bir pasif öğe için tekil PATCH çağrısı yap
    for (const item of inactiveItems) {
      try {
        // ÇALIŞAN TEKİL URL'i kullan: PATCH /inventory/{id}/restore
        const res = await authorizedFetch(
          `${API_URL}/inventory/${item.id}/restore`,
          {
            method: "PATCH",
          }
        );
        if (res.ok) {
          successCount++;
        } else {
          console.error(
            `Geri yükleme hatası ID ${item.id}: ${await res.text()}`
          );
        }
      } catch (e) {
        console.error(`Fetch hatası ID ${item.id}:`, e);
      }
    }

    if (successCount > 0) {
      alert(`${successCount} adet pasif kayıt başarıyla geri yüklendi.`);
    } else {
      alert("Tüm pasif kayıtlar geri yüklenirken hata oluştu.");
    }
    await loadInventories();
  });

  if (window.currentUser) loadInventories();
  window.addEventListener("userChanged", () => {
    if (window.currentUser) loadInventories();
    else {
      invBody.innerHTML = "";
      invCount.textContent = "0";
    }
  });
});

function getStatusLabel(value) {
  if (typeof value === "string") {
    const lower = value.toLowerCase();
    if (lower.includes("depoda")) return "Depoda";
    if (lower.includes("projede")) return "Projede";
    if (lower.includes("onarım")) return "Arızalı - Onarım";
    if (lower.includes("kullanım dışı")) return "Arızalı - Kullanım Dışı";
    if (lower.includes("stoktan")) return "Stoktan Çıkarıldı";
    return value;
  }

  switch (value) {
    case 0:
      return "Depoda";
    case 1:
      return "Projede";
    case 2:
      return "Arızalı - Onarım";
    case 3:
      return "Arızalı - Kullanım Dışı";
    case 4:
      return "Stoktan Çıkarıldı";
    default:
      return "";
  }
}

async function viewHistory(id) {
  try {
    const res = await authorizedFetch(`${API_URL}/inventory/${id}/history`);
    if (!res.ok) {
      alert("Tarihçe alınamadı.");
      return;
    }

    const history = await res.json();
    const container = document.getElementById("historyContainer");
    container.innerHTML = "";

    const exportBtn = document.createElement("button");
    exportBtn.textContent = "Excel'e Aktar";
    exportBtn.className = "outline";
    exportBtn.style.marginBottom = "12px";
    exportBtn.addEventListener("click", async () => {
      try {
        const exportUrl = `${API_URL}/inventory/${id}/history/export`;
        const res = await authorizedFetch(exportUrl);

        if (!res.ok) {
          alert("Tarihçe dışa aktarma başarısız!");
          return;
        }

        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Envanter_${id}_Tarihce_${
          new Date().toISOString().split("T")[0]
        }.xlsx`;
        a.click();
        window.URL.revokeObjectURL(url);
      } catch (e) {
        console.error("History export error:", e);
        alert("Tarihçe dışa aktarma sırasında hata oluştu.");
      }
    });

    container.appendChild(exportBtn);

    if (history.length === 0) {
      const p = document.createElement("p");
      p.textContent = "Bu envanter için tarihçe bulunmamaktadır.";
      container.appendChild(p);
    } else {
      const table = document.createElement("table");
      table.className = "history-table";

      table.innerHTML = `
        <thead>
          <tr>
            <th>İşlem</th>
            <th>Kullanıcı</th>
            <th>Tarih</th>
            <th>Seri No</th>
            <th>Marka</th>
            <th>Malzeme Adı</th>
            <th>Grup</th>
            <th>Model</th>
            <th>Durum</th>
            <th>Stok Giriş</th>
            <th>Stok Çıkış</th>
            <th>Açıklama</th>
            <th>Tahsis Edilen Proje</th>
            <th>Tahsis Edilen Kişi</th>
          </tr>
        </thead>
        <tbody></tbody>
      `;

      const tbody = table.querySelector("tbody");

      history.forEach((h) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${h.actionType}</td>
          <td>${h.changedBy || ""}</td>
          <td>${new Date(h.changedAt).toLocaleString()}</td>
          <td>${h.serialNumber || ""}</td>
          <td>${h.brand || ""}</td>
          <td>${h.itemName || ""}</td>
          <td>${h.itemGroup || ""}</td>
          <td>${h.model || ""}</td>
          <td>${getStatusLabel(h.status)}</td>
          <td>${
          h.stockInDate
            ? new Date(h.stockInDate).toLocaleDateString("tr-TR")
            : ""
        }</td>
          <td>${
          h.stockOutDate
            ? new Date(h.stockOutDate).toLocaleDateString("tr-TR")
            : ""
        }</td>

          <td>${h.description || ""}</td>
          <td>${h.assignedProject || ""}</td>
          <td>${h.assignedPerson || ""}</td>
        `;
        tbody.appendChild(tr);
      });

      container.appendChild(table);
    }

    document.getElementById("historyPanel").style.display = "flex";
  } catch (e) {
    console.error("viewHistory error:", e);
    alert("Tarihçe görüntüleme sırasında hata oluştu.");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const panel = document.getElementById("panelForm");
  const wrapper = document.querySelector(".inventory-wrapper");
  const toggleBtn = document.getElementById("toggleSlideBtn");

  if (!panel || !wrapper || !toggleBtn) return;

  toggleBtn.addEventListener("click", () => {
    panel.classList.toggle("collapsed");
    wrapper.classList.toggle(
      "panel-collapsed",
      panel.classList.contains("collapsed")
    );
  });

  document.addEventListener("click", (e) => {
    // Sadece inventory-wrapper içindeki tıklamaları dinle
    if (!document.querySelector(".inventory-wrapper")?.contains(e.target))
      return; // Sadece Düzenle butonunu hedefle

    const btn = e.target.closest(".icon-btn.edit");
    if (!btn) return; // Panel kapalıysa aç

    if (panel.classList.contains("collapsed")) {
      panel.classList.remove("collapsed");
      wrapper.classList.remove("panel-collapsed");
    }
  });
});
const descModal = document.createElement("div");
descModal.id = "descModal";
descModal.className = "desc-modal hidden";
descModal.innerHTML = `
  <div class="desc-modal-content">
    <h3>Açıklama</h3>
    <div id="descModalText" class="desc-text"></div>
    <button id="descCloseBtn" class="outline" style="margin-top:12px;">Kapat</button>
  </div>
`;
document.body.appendChild(descModal);

document.addEventListener("click", (e) => {
  if (e.target.classList.contains("desc-more")) {
    const fullText = e.target.dataset.full;
    document.getElementById("descModalText").textContent = fullText;
    descModal.classList.remove("hidden");
  }
});

document.getElementById("descCloseBtn")?.addEventListener("click", () => {
  descModal.classList.add("hidden");
});

descModal.addEventListener("click", (e) => {
  if (e.target.id === "descModal") descModal.classList.add("hidden");
});
