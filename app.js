const MAX_FILE_SIZE = Math.floor(4.5 * 1024 * 1024);
const ROOT_FOLDER_NAME = "我的圖片";
const ROOT_FOLDER_ID = encodeURIComponent(ROOT_FOLDER_NAME);
const SELECTED_FOLDER_KEY = "image-space-selected-folder";

const elements = {
  uploadTrigger: document.querySelector("#uploadTrigger"),
  fileInput: document.querySelector("#fileInput"),
  openFolderModal: document.querySelector("#openFolderModal"),
  closeFolderModal: document.querySelector("#closeFolderModal"),
  folderModal: document.querySelector("#folderModal"),
  folderForm: document.querySelector("#folderForm"),
  folderNameInput: document.querySelector("#folderNameInput"),
  submitFolderForm: document.querySelector("#submitFolderForm"),
  folderList: document.querySelector("#folderList"),
  galleryStage: document.querySelector("#galleryStage"),
  galleryGrid: document.querySelector("#galleryGrid"),
  emptyState: document.querySelector("#emptyState"),
  statusMessage: document.querySelector("#statusMessage"),
  currentFolderName: document.querySelector("#currentFolderName"),
  folderCount: document.querySelector("#folderCount"),
  imageCount: document.querySelector("#imageCount"),
  galleryCount: document.querySelector("#galleryCount"),
};

const state = {
  folders: [],
  images: [],
  selectedFolderId: null,
  isBusy: false,
};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  bindEvents();
  setBusy(true);

  try {
    await refreshLibrary();
    setStatus("準備完成，可以開始上傳圖片。");
  } catch (error) {
    console.error(error);
    setStatus("初始化失敗，請確認 Vercel Blob 設定。", true);
  } finally {
    setBusy(false);
  }
}

function bindEvents() {
  elements.uploadTrigger?.addEventListener("click", () => {
    if (state.isBusy) {
      return;
    }

    elements.fileInput?.click();
  });

  elements.fileInput?.addEventListener("change", handleUpload);
  elements.openFolderModal?.addEventListener("click", () => {
    if (state.isBusy) {
      return;
    }

    openFolderModal();
  });
  elements.closeFolderModal?.addEventListener("click", closeFolderModal);
  elements.folderForm?.addEventListener("submit", handleCreateFolder);

  elements.folderModal?.addEventListener("click", (event) => {
    if (event.target === elements.folderModal) {
      closeFolderModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && elements.folderModal?.classList.contains("open")) {
      closeFolderModal();
    }
  });
}

function openFolderModal() {
  elements.folderModal?.classList.add("open");
  elements.folderModal?.setAttribute("aria-hidden", "false");
  requestAnimationFrame(() => elements.folderNameInput?.focus());
}

function closeFolderModal() {
  elements.folderModal?.classList.remove("open");
  elements.folderModal?.setAttribute("aria-hidden", "true");
  elements.folderForm?.reset();
}

async function handleCreateFolder(event) {
  event.preventDefault();

  const rawName = elements.folderNameInput?.value.trim() || "";
  if (!rawName) {
    setStatus("資料夾名稱不能是空的。", true);
    return;
  }

  const duplicated = state.folders.some(
    (folder) => folder.name.toLowerCase() === rawName.toLowerCase(),
  );

  if (duplicated) {
    setStatus("已經有同名資料夾了。", true);
    return;
  }

  try {
    setBusy(true);

    const response = await fetch("/api/folders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: rawName }),
    });

    const payload = await parseJson(response);
    if (!response.ok) {
      throw new Error(payload.error || "建立資料夾失敗。");
    }

    state.selectedFolderId = payload.folder.id;
    saveSelectedFolder();
    await refreshLibrary(payload.folder.id);
    closeFolderModal();
    setStatus(`資料夾 ${rawName} 已建立。`);
  } catch (error) {
    console.error(error);
    setStatus(error.message || "建立資料夾失敗。", true);
  } finally {
    setBusy(false);
  }
}

async function handleUpload(event) {
  if (state.isBusy) {
    return;
  }

  const files = Array.from(event.target.files ?? []);
  if (elements.fileInput) {
    elements.fileInput.value = "";
  }

  if (files.length === 0) {
    return;
  }

  if (files.some((file) => !file.type.startsWith("image/"))) {
    setStatus("只能上傳圖片檔案。", true);
    return;
  }

  const oversized = files.find((file) => file.size > MAX_FILE_SIZE);
  if (oversized) {
    setStatus(`圖片 ${oversized.name} 超過 4.5 MB。`, true);
    return;
  }

  const targetFolder = getUploadFolder();
  if (!targetFolder) {
    setStatus("請先選擇資料夾。", true);
    return;
  }

  try {
    setBusy(true);

    let completed = 0;
    for (const file of files) {
      completed += 1;
      setStatus(`上傳中 ${completed}/${files.length}`);
      await uploadSingleFile(file, targetFolder.id);
    }

    await refreshLibrary(state.selectedFolderId);
    setStatus(`已上傳 ${files.length} 張圖片。`);
  } catch (error) {
    console.error(error);
    setStatus(error.message || "上傳失敗。", true);
  } finally {
    setBusy(false);
  }
}

async function refreshLibrary(preferredFolderId = state.selectedFolderId) {
  const response = await fetch("/api/library", {
    cache: "no-store",
  });

  const payload = await parseJson(response);
  if (!response.ok) {
    throw new Error(payload.error || "讀取資料失敗。");
  }

  state.folders = payload.folders || [];
  state.images = payload.images || [];

  const savedFolderId = localStorage.getItem(SELECTED_FOLDER_KEY);
  const nextFolderId = preferredFolderId ?? savedFolderId;

  if (nextFolderId && state.folders.some((folder) => folder.id === nextFolderId && folder.id !== ROOT_FOLDER_ID)) {
    state.selectedFolderId = nextFolderId;
  } else {
    state.selectedFolderId = null;
  }

  saveSelectedFolder();
  render();
}

async function uploadSingleFile(file, folderId) {
  const formData = new FormData();
  formData.set("folderId", folderId);
  formData.set("file", file);

  const response = await fetch("/api/upload", {
    method: "POST",
    body: formData,
  });

  const payload = await parseJson(response);
  if (!response.ok) {
    throw new Error(payload.error || "上傳失敗。");
  }
}

function render() {
  renderFolderList();
  renderGallery();
  renderStats();
}

function renderFolderList() {
  if (!elements.folderList) {
    return;
  }

  const customFolders = state.folders.filter((folder) => folder.id !== ROOT_FOLDER_ID);

  elements.folderList.innerHTML = "";
  elements.folderList.hidden = customFolders.length === 0;

  customFolders.forEach((folder) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `folder-pill${folder.id === state.selectedFolderId ? " active" : ""}`;
    button.setAttribute("aria-label", folder.name);

    const art = document.createElement("span");
    art.className = "folder-art";
    art.setAttribute("aria-hidden", "true");
    art.innerHTML = getFolderIconMarkup();
    button.append(art);

    const label = document.createElement("strong");
    label.textContent = folder.name;
    button.append(label);

    button.addEventListener("click", () => {
      if (state.isBusy) {
        return;
      }

      state.selectedFolderId = state.selectedFolderId === folder.id ? null : folder.id;
      saveSelectedFolder();
      render();
      setStatus(state.selectedFolderId ? folder.name : "首頁");
    });

    elements.folderList?.append(button);
  });
}

function renderGallery() {
  if (!elements.galleryGrid || !elements.galleryStage) {
    return;
  }

  const viewedFolderId = getViewedFolderId();
  const images = state.images.filter((image) => image.folderId === viewedFolderId);
  elements.galleryGrid.innerHTML = "";
  elements.galleryStage.hidden = images.length === 0;

  images.forEach((image) => {
    const article = document.createElement("article");
    article.className = "gallery-item";

    const img = document.createElement("img");
    img.src = image.url;
    img.alt = "";
    img.loading = "lazy";
    img.decoding = "async";

    article.append(img);
    elements.galleryGrid?.append(article);
  });

  if (elements.emptyState) {
    elements.emptyState.hidden = true;
  }

  updateText(elements.currentFolderName, state.selectedFolderId ? getSelectedFolder()?.name || "" : "首頁");
  updateText(elements.galleryCount, String(images.length));
}

function renderStats() {
  updateText(elements.folderCount, String(state.folders.length));
  updateText(elements.imageCount, String(state.images.length));
}

function getViewedFolderId() {
  return state.selectedFolderId || ROOT_FOLDER_ID;
}

function getUploadFolder() {
  return getSelectedFolder() || getRootFolder();
}

function getSelectedFolder() {
  return state.folders.find((folder) => folder.id === state.selectedFolderId) ?? null;
}

function getRootFolder() {
  return state.folders.find((folder) => folder.id === ROOT_FOLDER_ID) ?? null;
}

function saveSelectedFolder() {
  if (!state.selectedFolderId || state.selectedFolderId === ROOT_FOLDER_ID) {
    localStorage.removeItem(SELECTED_FOLDER_KEY);
    return;
  }

  localStorage.setItem(SELECTED_FOLDER_KEY, state.selectedFolderId);
}

function setStatus(message, isError = false) {
  updateText(elements.statusMessage, message);
  document.body.dataset.state = isError ? "error" : "ready";
}

function updateText(element, value) {
  if (element) {
    element.textContent = value;
  }
}

async function parseJson(response) {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    console.error(error);
    return {};
  }
}

function setBusy(isBusy) {
  state.isBusy = isBusy;

  if (elements.uploadTrigger) {
    elements.uploadTrigger.setAttribute("aria-disabled", String(isBusy));
  }

  if (elements.openFolderModal) {
    elements.openFolderModal.setAttribute("aria-disabled", String(isBusy));
  }

  if (elements.fileInput) {
    elements.fileInput.disabled = isBusy;
  }

  if (elements.closeFolderModal) {
    elements.closeFolderModal.disabled = isBusy;
  }

  if (elements.folderNameInput) {
    elements.folderNameInput.disabled = isBusy;
  }

  if (elements.submitFolderForm) {
    elements.submitFolderForm.disabled = isBusy;
  }
}

function getFolderIconMarkup() {
  return `
    <svg viewBox="0 0 120 120" class="line-icon">
      <path d="M16 42c0-6 5-11 11-11h22l9 10h35c6 0 11 5 11 11v33c0 8-6 14-14 14H30c-8 0-14-6-14-14V42z" />
      <path d="M16 49h88" />
    </svg>
  `;
}
