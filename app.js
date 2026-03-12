const DB_NAME = "image-space-db";
const DB_VERSION = 1;
const FOLDER_STORE = "folders";
const IMAGE_STORE = "images";
const DEFAULT_FOLDER_ID = "folder-default";
const SELECTED_FOLDER_KEY = "image-space-selected-folder";

const elements = {
  uploadTrigger: document.querySelector("#uploadTrigger"),
  fileInput: document.querySelector("#fileInput"),
  openFolderModal: document.querySelector("#openFolderModal"),
  closeFolderModal: document.querySelector("#closeFolderModal"),
  folderModal: document.querySelector("#folderModal"),
  folderForm: document.querySelector("#folderForm"),
  folderNameInput: document.querySelector("#folderNameInput"),
  folderList: document.querySelector("#folderList"),
  galleryGrid: document.querySelector("#galleryGrid"),
  emptyState: document.querySelector("#emptyState"),
  statusMessage: document.querySelector("#statusMessage"),
  currentFolderName: document.querySelector("#currentFolderName"),
  folderCount: document.querySelector("#folderCount"),
  imageCount: document.querySelector("#imageCount"),
  galleryCount: document.querySelector("#galleryCount"),
};

const state = {
  db: null,
  folders: [],
  images: [],
  selectedFolderId: DEFAULT_FOLDER_ID,
  previewUrls: [],
};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  bindEvents();

  if (!("indexedDB" in window)) {
    setStatus("你的瀏覽器不支援 IndexedDB，無法儲存圖片。", true);
    return;
  }

  try {
    state.db = await openDatabase();
    await ensureDefaultFolder();
    await loadState();
    render();
    setStatus("準備完成，可以開始上傳圖片。");
  } catch (error) {
    console.error(error);
    setStatus("初始化失敗，請重新整理後再試一次。", true);
  }
}

function bindEvents() {
  elements.uploadTrigger.addEventListener("click", () => {
    elements.fileInput.click();
  });

  elements.fileInput.addEventListener("change", handleUpload);
  elements.openFolderModal.addEventListener("click", openFolderModal);
  elements.closeFolderModal.addEventListener("click", closeFolderModal);
  elements.folderModal.addEventListener("click", (event) => {
    if (event.target === elements.folderModal) {
      closeFolderModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && elements.folderModal.classList.contains("open")) {
      closeFolderModal();
    }
  });

  elements.folderForm.addEventListener("submit", handleCreateFolder);
}

function openFolderModal() {
  elements.folderModal.classList.add("open");
  elements.folderModal.setAttribute("aria-hidden", "false");
  requestAnimationFrame(() => elements.folderNameInput.focus());
}

function closeFolderModal() {
  elements.folderModal.classList.remove("open");
  elements.folderModal.setAttribute("aria-hidden", "true");
  elements.folderForm.reset();
}

async function handleCreateFolder(event) {
  event.preventDefault();

  const rawName = elements.folderNameInput.value.trim();
  if (!rawName) {
    setStatus("資料夾名稱不能是空的。", true);
    return;
  }

  const duplicated = state.folders.some(
    (folder) => folder.name.toLowerCase() === rawName.toLowerCase(),
  );

  if (duplicated) {
    setStatus("已經有同名資料夾了，換一個名稱。", true);
    return;
  }

  const folder = {
    id: `folder-${Date.now()}`,
    name: rawName,
    createdAt: new Date().toISOString(),
  };

  await putRecord(FOLDER_STORE, folder);
  state.selectedFolderId = folder.id;
  saveSelectedFolder();

  await loadState();
  render();
  closeFolderModal();
  setStatus(`資料夾「${rawName}」已建立。`);
}

async function handleUpload(event) {
  const files = Array.from(event.target.files ?? []);
  elements.fileInput.value = "";

  if (files.length === 0) {
    return;
  }

  const nonImages = files.filter((file) => !file.type.startsWith("image/"));
  if (nonImages.length > 0) {
    setStatus("只能上傳圖片檔案。", true);
    return;
  }

  const targetFolder = getSelectedFolder();
  if (!targetFolder) {
    setStatus("請先選擇資料夾。", true);
    return;
  }

  try {
    await Promise.all(
      files.map((file) =>
        putRecord(IMAGE_STORE, {
          id: `image-${crypto.randomUUID()}`,
          folderId: targetFolder.id,
          name: file.name,
          size: file.size,
          type: file.type,
          uploadedAt: new Date().toISOString(),
          blob: file,
        }),
      ),
    );

    await loadState();
    render();
    setStatus(`上傳成功，已加入 ${files.length} 張圖片到「${targetFolder.name}」。`);
  } catch (error) {
    console.error(error);
    setStatus("上傳失敗，請再試一次。", true);
  }
}

async function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.addEventListener("upgradeneeded", () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(FOLDER_STORE)) {
        db.createObjectStore(FOLDER_STORE, { keyPath: "id" });
      }

      if (!db.objectStoreNames.contains(IMAGE_STORE)) {
        const imageStore = db.createObjectStore(IMAGE_STORE, { keyPath: "id" });
        imageStore.createIndex("folderId", "folderId", { unique: false });
      }
    });

    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => reject(request.error));
  });
}

async function ensureDefaultFolder() {
  const defaultFolder = await getRecord(FOLDER_STORE, DEFAULT_FOLDER_ID);

  if (defaultFolder) {
    return;
  }

  await putRecord(FOLDER_STORE, {
    id: DEFAULT_FOLDER_ID,
    name: "我的圖片",
    createdAt: new Date().toISOString(),
  });
}

async function loadState() {
  const [folders, images] = await Promise.all([getAllRecords(FOLDER_STORE), getAllRecords(IMAGE_STORE)]);

  state.folders = folders.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  state.images = images.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));

  const savedFolderId = localStorage.getItem(SELECTED_FOLDER_KEY);
  const hasSavedFolder = state.folders.some((folder) => folder.id === savedFolderId);

  if (hasSavedFolder) {
    state.selectedFolderId = savedFolderId;
  } else if (!state.folders.some((folder) => folder.id === state.selectedFolderId)) {
    state.selectedFolderId = state.folders[0]?.id ?? DEFAULT_FOLDER_ID;
  }
}

function render() {
  renderFolderList();
  renderGallery();
  renderStats();
}

function renderFolderList() {
  elements.folderList.innerHTML = "";

  state.folders.forEach((folder) => {
    const count = state.images.filter((image) => image.folderId === folder.id).length;
    const button = document.createElement("button");
    button.type = "button";
    button.className = `folder-pill${folder.id === state.selectedFolderId ? " active" : ""}`;
    button.innerHTML = `
      <div>
        <strong>${escapeHtml(folder.name)}</strong>
        <span>${formatDate(folder.createdAt)}</span>
      </div>
      <span class="folder-badge">${count}</span>
    `;
    button.addEventListener("click", () => {
      state.selectedFolderId = folder.id;
      saveSelectedFolder();
      render();
      setStatus(`目前正在查看「${folder.name}」。`);
    });

    elements.folderList.append(button);
  });
}

function renderGallery() {
  cleanupPreviewUrls();
  elements.galleryGrid.innerHTML = "";

  const folder = getSelectedFolder();
  const images = state.images.filter((image) => image.folderId === state.selectedFolderId);

  elements.currentFolderName.textContent = folder?.name ?? "未選擇";
  elements.galleryCount.textContent = `${images.length} 張`;
  elements.emptyState.hidden = images.length > 0;

  images.forEach((image) => {
    const imageUrl = URL.createObjectURL(image.blob);
    state.previewUrls.push(imageUrl);

    const article = document.createElement("article");
    article.className = "gallery-item";
    article.innerHTML = `
      <img src="${imageUrl}" alt="${escapeHtml(image.name)}" />
      <div class="image-meta">
        <strong>${escapeHtml(image.name)}</strong>
        <p>${formatSize(image.size)} · ${formatDate(image.uploadedAt)}</p>
      </div>
    `;

    elements.galleryGrid.append(article);
  });
}

function renderStats() {
  elements.folderCount.textContent = String(state.folders.length);
  elements.imageCount.textContent = String(state.images.length);
}

function cleanupPreviewUrls() {
  state.previewUrls.forEach((url) => URL.revokeObjectURL(url));
  state.previewUrls = [];
}

function getSelectedFolder() {
  return state.folders.find((folder) => folder.id === state.selectedFolderId) ?? null;
}

function saveSelectedFolder() {
  localStorage.setItem(SELECTED_FOLDER_KEY, state.selectedFolderId);
}

function setStatus(message, isError = false) {
  elements.statusMessage.textContent = message;
  elements.statusMessage.style.color = isError ? "var(--accent-deep)" : "var(--secondary)";
}

function getRecord(storeName, key) {
  return new Promise((resolve, reject) => {
    const transaction = state.db.transaction(storeName, "readonly");
    const request = transaction.objectStore(storeName).get(key);
    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => reject(request.error));
  });
}

function getAllRecords(storeName) {
  return new Promise((resolve, reject) => {
    const transaction = state.db.transaction(storeName, "readonly");
    const request = transaction.objectStore(storeName).getAll();
    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => reject(request.error));
  });
}

function putRecord(storeName, value) {
  return new Promise((resolve, reject) => {
    const transaction = state.db.transaction(storeName, "readwrite");
    const request = transaction.objectStore(storeName).put(value);
    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => reject(request.error));
  });
}

function formatDate(value) {
  return new Intl.DateTimeFormat("zh-TW", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function formatSize(bytes) {
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

window.addEventListener("beforeunload", cleanupPreviewUrls);
