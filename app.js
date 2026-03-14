const MAX_FILE_SIZE = Math.floor(4.5 * 1024 * 1024);
const ROOT_FOLDER_NAME = "我的圖片";
const ROOT_FOLDER_ID = encodeURIComponent(ROOT_FOLDER_NAME);
const LIBRARY_CACHE_KEY = "image-space-library";
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
  imageViewer: document.querySelector("#imageViewer"),
  previewImage: document.querySelector("#previewImage"),
  closePreview: document.querySelector("#closePreview"),
  downloadPreview: document.querySelector("#downloadPreview"),
  copyPreview: document.querySelector("#copyPreview"),
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
  activePreview: null,
};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  bindEvents();
  restoreLibraryCache();
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
  elements.closePreview?.addEventListener("click", closeImageViewer);
  elements.downloadPreview?.addEventListener("click", handleDownloadPreview);
  elements.copyPreview?.addEventListener("click", handleCopyPreview);

  elements.folderModal?.addEventListener("click", (event) => {
    if (event.target === elements.folderModal) {
      closeFolderModal();
    }
  });

  elements.imageViewer?.addEventListener("click", (event) => {
    if (event.target === elements.imageViewer) {
      closeImageViewer();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && isImageViewerOpen()) {
      closeImageViewer();
      return;
    }

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

function openImageViewer(image) {
  state.activePreview = image;

  if (elements.previewImage) {
    elements.previewImage.src = image.url;
    elements.previewImage.alt = image.name || "";
  }

  elements.imageViewer?.classList.add("open");
  elements.imageViewer?.setAttribute("aria-hidden", "false");
  document.body.classList.add("viewer-open");
}

function closeImageViewer() {
  state.activePreview = null;
  elements.imageViewer?.classList.remove("open");
  elements.imageViewer?.setAttribute("aria-hidden", "true");
  document.body.classList.remove("viewer-open");

  if (elements.previewImage) {
    elements.previewImage.src = "";
    elements.previewImage.alt = "";
  }
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
    const previousFolderId = state.selectedFolderId;

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

    state.selectedFolderId = previousFolderId;
    saveSelectedFolder();
    await refreshLibrary(previousFolderId);
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
  try {
    const response = await fetch("/api/library", {
      cache: "no-store",
    });

    const payload = await parseJson(response);
    if (!response.ok) {
      throw new Error(payload.error || "讀取資料失敗。");
    }

    applyLibraryPayload(payload, preferredFolderId);
    saveLibraryCache();
  } catch (error) {
    if (restoreLibraryCache(preferredFolderId)) {
      return;
    }

    throw error;
  }
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
      setStatus(state.selectedFolderId ? folder.name : "全部圖片");
    });

    elements.folderList?.append(button);
  });
}

function renderGallery() {
  if (!elements.galleryGrid || !elements.galleryStage) {
    return;
  }

  const images = state.selectedFolderId
    ? state.images.filter((image) => image.folderId === state.selectedFolderId)
    : state.images;

  elements.galleryGrid.innerHTML = "";
  elements.galleryStage.hidden = images.length === 0;

  images.forEach((image) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "gallery-item";
    button.setAttribute("aria-label", image.name || "開啟圖片");

    const img = document.createElement("img");
    img.src = image.thumbnailUrl || image.url;
    img.alt = "";
    img.loading = "lazy";
    img.decoding = "async";

    button.addEventListener("click", () => openImageViewer(image));
    button.append(img);
    elements.galleryGrid?.append(button);
  });

  if (elements.emptyState) {
    elements.emptyState.hidden = true;
  }

  updateText(elements.currentFolderName, state.selectedFolderId ? getSelectedFolder()?.name || "" : "全部圖片");
  updateText(elements.galleryCount, String(images.length));
}

function renderStats() {
  updateText(elements.folderCount, String(state.folders.length));
  updateText(elements.imageCount, String(state.images.length));
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

function applyLibraryPayload(payload, preferredFolderId = state.selectedFolderId) {
  state.folders = Array.isArray(payload.folders) ? payload.folders : [];
  state.images = Array.isArray(payload.images) ? payload.images : [];

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

function saveLibraryCache() {
  localStorage.setItem(
    LIBRARY_CACHE_KEY,
    JSON.stringify({
      folders: state.folders,
      images: state.images,
    }),
  );
}

function restoreLibraryCache(preferredFolderId = state.selectedFolderId) {
  const cached = localStorage.getItem(LIBRARY_CACHE_KEY);
  if (!cached) {
    return false;
  }

  try {
    const payload = JSON.parse(cached);
    applyLibraryPayload(payload, preferredFolderId);
    return true;
  } catch (error) {
    console.error(error);
    localStorage.removeItem(LIBRARY_CACHE_KEY);
    return false;
  }
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

function isImageViewerOpen() {
  return elements.imageViewer?.classList.contains("open");
}

async function handleDownloadPreview() {
  if (!state.activePreview) {
    return;
  }

  try {
    setViewerBusy(true);
    const fileBlob = await fetchPreviewBlob();
    const objectUrl = URL.createObjectURL(fileBlob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = state.activePreview.name || "image";
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
    setStatus("圖片已下載。");
  } catch (error) {
    console.error(error);
    setStatus(error.message || "下載失敗。", true);
  } finally {
    setViewerBusy(false);
  }
}

async function handleCopyPreview() {
  if (!state.activePreview) {
    return;
  }

  try {
    setViewerBusy(true);
    const fileBlob = await fetchPreviewBlob();

    if (navigator.clipboard?.write && window.ClipboardItem) {
      await navigator.clipboard.write([
        new ClipboardItem({
          [fileBlob.type || "image/png"]: fileBlob,
        }),
      ]);
      setStatus("圖片已複製。");
      return;
    }

    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(state.activePreview.url);
      setStatus("已複製圖片網址。");
      return;
    }

    throw new Error("目前瀏覽器不支援複製。");
  } catch (error) {
    console.error(error);
    setStatus(error.message || "複製失敗。", true);
  } finally {
    setViewerBusy(false);
  }
}

async function fetchPreviewBlob() {
  if (!state.activePreview) {
    throw new Error("目前沒有可用的圖片。");
  }

  const response = await fetch(state.activePreview.url, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("讀取圖片失敗。");
  }

  return response.blob();
}

function setViewerBusy(isBusy) {
  if (elements.downloadPreview) {
    elements.downloadPreview.disabled = isBusy;
  }

  if (elements.copyPreview) {
    elements.copyPreview.disabled = isBusy;
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
