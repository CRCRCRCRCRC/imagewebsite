const MAX_FILE_SIZE = Math.floor(4.5 * 1024 * 1024);
const EDITOR_DEFAULT_COLOR = "#0f1a2b";
const EDITOR_DEFAULT_BRUSH = 8;
const EDITOR_HISTORY_LIMIT = 12;
const EDITOR_MAX_EDGE = 2400;
const ROOT_FOLDER_NAME = "我的圖片";
const ROOT_FOLDER_ID = encodeURIComponent(ROOT_FOLDER_NAME);
const LIBRARY_CACHE_KEY = "image-space-library";
const SELECTED_FOLDER_KEY = "image-space-selected-folder";
const NOTEBOOK_CONTENT_KEY = "image-space-notebook-content";
const NOTEBOOK_VIEW_KEY = "image-space-notebook-view";
const NOTEBOOK_TODOS_KEY = "image-space-notebook-todos";
const LEGACY_NOTEBOOK_TODO_KEYS = [
  NOTEBOOK_TODOS_KEY,
  "image-space-notebook-todo-list",
  "image-space-todos",
];

const elements = {
  openNotebookMode: document.querySelector("#openNotebookMode"),
  closeNotebookMode: document.querySelector("#closeNotebookMode"),
  notebookMode: document.querySelector("#notebookMode"),
  notebookTextarea: document.querySelector("#notebookTextarea"),
  showNotebookNotes: document.querySelector("#showNotebookNotes"),
  showNotebookTodo: document.querySelector("#showNotebookTodo"),
  notebookNotesPanel: document.querySelector("#notebookNotesPanel"),
  notebookTodoPanel: document.querySelector("#notebookTodoPanel"),
  todoForm: document.querySelector("#todoForm"),
  todoInput: document.querySelector("#todoInput"),
  todoPriceInput: document.querySelector("#todoPriceInput"),
  todoList: document.querySelector("#todoList"),
  todoTotalAmount: document.querySelector("#todoTotalAmount"),
  todoOpenAmount: document.querySelector("#todoOpenAmount"),
  uploadTrigger: document.querySelector("#uploadTrigger"),
  fileInput: document.querySelector("#fileInput"),
  uploadModal: document.querySelector("#uploadModal"),
  closeUploadModal: document.querySelector("#closeUploadModal"),
  uploadDropzone: document.querySelector("#uploadDropzone"),
  chooseUploadFiles: document.querySelector("#chooseUploadFiles"),
  submitUploadQueue: document.querySelector("#submitUploadQueue"),
  uploadQueue: document.querySelector("#uploadQueue"),
  openFolderModal: document.querySelector("#openFolderModal"),
  closeFolderModal: document.querySelector("#closeFolderModal"),
  folderModal: document.querySelector("#folderModal"),
  folderForm: document.querySelector("#folderForm"),
  folderNameInput: document.querySelector("#folderNameInput"),
  submitFolderForm: document.querySelector("#submitFolderForm"),
  imageViewer: document.querySelector("#imageViewer"),
  imageEditor: document.querySelector("#imageEditor"),
  editorStage: document.querySelector("#editorStage"),
  editorCanvas: document.querySelector("#editorCanvas"),
  editorHint: document.querySelector("#editorHint"),
  editPreview: document.querySelector("#editPreview"),
  editorCropTool: document.querySelector("#editorCropTool"),
  editorDrawTool: document.querySelector("#editorDrawTool"),
  editorEraserTool: document.querySelector("#editorEraserTool"),
  applyCropTool: document.querySelector("#applyCropTool"),
  editorUndo: document.querySelector("#editorUndo"),
  editorRedo: document.querySelector("#editorRedo"),
  editorRotateLeft: document.querySelector("#editorRotateLeft"),
  editorRotateRight: document.querySelector("#editorRotateRight"),
  resetEditor: document.querySelector("#resetEditor"),
  editorColor: document.querySelector("#editorColor"),
  editorBrushSize: document.querySelector("#editorBrushSize"),
  closeEditor: document.querySelector("#closeEditor"),
  saveEditor: document.querySelector("#saveEditor"),
  renamePreview: document.querySelector("#renamePreview"),
  previewImage: document.querySelector("#previewImage"),
  previewName: document.querySelector("#previewName"),
  closePreview: document.querySelector("#closePreview"),
  downloadPreview: document.querySelector("#downloadPreview"),
  copyPreview: document.querySelector("#copyPreview"),
  deletePreview: document.querySelector("#deletePreview"),
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
  uploadQueue: [],
  editor: createEditorStateV2(),
  notebookSaveTimer: 0,
  notebookSyncTimer: 0,
  isNotebookSyncing: false,
  isNotebookSyncQueued: false,
  notebookView: "notes",
  notebookTodos: [],
};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  bindEvents();
  restoreNotebookStateV2();
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

  try {
    await syncNotebookStateFromServerV4();
  } catch (error) {
    console.error(error);
  }
}

function bindEvents() {
  elements.openNotebookMode?.addEventListener("click", openNotebookMode);
  elements.closeNotebookMode?.addEventListener("click", closeNotebookMode);
  elements.notebookTextarea?.addEventListener("input", handleNotebookInput);
  elements.notebookTextarea?.addEventListener("blur", handleNotebookBlurV4);
  elements.showNotebookNotes?.addEventListener("click", () => setNotebookView("notes"));
  elements.showNotebookTodo?.addEventListener("click", () => setNotebookView("todo"));
  elements.todoForm?.addEventListener("submit", handleTodoSubmit);
  elements.todoList?.addEventListener("click", handleTodoListClick);
  elements.todoList?.addEventListener("change", handleTodoListChange);
  elements.uploadTrigger?.addEventListener("click", () => {
    if (state.isBusy) {
      return;
    }

    openUploadModal();
  });

  elements.fileInput?.addEventListener("change", handleUploadSelection);
  elements.closeUploadModal?.addEventListener("click", () => closeUploadModal());
  elements.chooseUploadFiles?.addEventListener("click", () => {
    if (state.isBusy) {
      return;
    }

    elements.fileInput?.click();
  });
  elements.submitUploadQueue?.addEventListener("click", handleUploadQueueSubmit);
  elements.uploadDropzone?.addEventListener("click", () => {
    if (state.isBusy) {
      return;
    }

    elements.fileInput?.click();
  });
  elements.uploadDropzone?.addEventListener("keydown", handleUploadDropzoneKeydown);
  elements.uploadDropzone?.addEventListener("dragenter", handleUploadDragEnter);
  elements.uploadDropzone?.addEventListener("dragover", handleUploadDragOver);
  elements.uploadDropzone?.addEventListener("dragleave", handleUploadDragLeave);
  elements.uploadDropzone?.addEventListener("drop", handleUploadDrop);
  elements.openFolderModal?.addEventListener("click", () => {
    if (state.isBusy) {
      return;
    }

    openFolderModal();
  });
  elements.closeFolderModal?.addEventListener("click", closeFolderModal);
  elements.folderForm?.addEventListener("submit", handleCreateFolder);
  elements.renamePreview?.addEventListener("click", handleRenamePreviewFast);
  elements.editPreview?.addEventListener("click", openImageEditorV2);
  elements.closePreview?.addEventListener("click", closeImageViewer);
  elements.downloadPreview?.addEventListener("click", handleDownloadPreview);
  elements.copyPreview?.addEventListener("click", handleCopyPreview);
  elements.deletePreview?.addEventListener("click", handleDeletePreview);
  elements.editorCropTool?.addEventListener("click", () => setEditorToolV2("crop"));
  elements.editorDrawTool?.addEventListener("click", () => setEditorToolV2("draw"));
  elements.editorEraserTool?.addEventListener("click", () => setEditorToolV2("erase"));
  elements.applyCropTool?.addEventListener("click", applyEditorCropV2);
  elements.editorUndo?.addEventListener("click", undoImageEditorV2);
  elements.editorRedo?.addEventListener("click", redoImageEditorV2);
  elements.editorRotateLeft?.addEventListener("click", () => rotateImageEditorV2(-1));
  elements.editorRotateRight?.addEventListener("click", () => rotateImageEditorV2(1));
  elements.resetEditor?.addEventListener("click", resetImageEditorV2);
  elements.closeEditor?.addEventListener("click", closeImageEditorV2);
  elements.saveEditor?.addEventListener("click", saveImageEditorV2);
  elements.editorColor?.addEventListener("input", handleEditorColorChange);
  elements.editorBrushSize?.addEventListener("input", handleEditorBrushSizeChange);
  elements.editorCanvas?.addEventListener("pointerdown", handleEditorPointerDownV2);
  elements.editorCanvas?.addEventListener("pointermove", handleEditorPointerMoveV2);
  elements.editorCanvas?.addEventListener("pointerup", handleEditorPointerUpV2);
  elements.editorCanvas?.addEventListener("pointerleave", handleEditorPointerUpV2);
  elements.editorCanvas?.addEventListener("pointercancel", handleEditorPointerUpV2);
  elements.editorCanvas?.addEventListener("touchstart", blockEditorGestureV2, { passive: false });
  elements.editorCanvas?.addEventListener("touchmove", blockEditorGestureV2, { passive: false });
  elements.editorCanvas?.addEventListener("gesturestart", blockEditorGestureV2);
  elements.editorCanvas?.addEventListener("gesturechange", blockEditorGestureV2);
  elements.editorCanvas?.addEventListener("gestureend", blockEditorGestureV2);
  elements.editorCanvas?.addEventListener("wheel", handleEditorWheelZoomV2, { passive: false });
  elements.imageEditor?.addEventListener("touchstart", blockEditorGestureV2, { passive: false });
  elements.imageEditor?.addEventListener("touchmove", blockEditorGestureV2, { passive: false });
  elements.imageEditor?.addEventListener("gesturestart", blockEditorGestureV2);
  elements.imageEditor?.addEventListener("gesturechange", blockEditorGestureV2);
  elements.imageEditor?.addEventListener("gestureend", blockEditorGestureV2);
  elements.imageEditor?.addEventListener("wheel", handleEditorWheelZoomV2, { passive: false });

  elements.folderModal?.addEventListener("click", (event) => {
    if (event.target === elements.folderModal) {
      closeFolderModal();
    }
  });

  elements.uploadModal?.addEventListener("click", (event) => {
    if (event.target === elements.uploadModal) {
      closeUploadModal();
    }
  });

  elements.imageViewer?.addEventListener("click", (event) => {
    if (event.target === elements.imageViewer) {
      closeImageViewer();
    }
  });

  elements.imageEditor?.addEventListener("click", (event) => {
    if (event.target === elements.imageEditor) {
      closeImageEditorV2();
    }
  });

  elements.notebookMode?.addEventListener("click", (event) => {
    if (event.target === elements.notebookMode) {
      closeNotebookMode();
    }
  });

  document.addEventListener("paste", handleUploadPaste);
  window.addEventListener("resize", handleEditorViewportChangeV2);
  window.addEventListener("wheel", handleEditorWheelZoomV2, { passive: false });
  window.addEventListener("gesturestart", blockEditorGestureV2);
  window.addEventListener("gesturechange", blockEditorGestureV2);
  window.addEventListener("gestureend", blockEditorGestureV2);
  window.addEventListener("pagehide", flushNotebookSyncV4);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && isNotebookOpen()) {
      closeNotebookMode();
      return;
    }

    if (event.key === "Escape" && isImageEditorOpen()) {
      closeImageEditorV2();
      return;
    }

    if (event.key === "Escape" && isImageViewerOpen()) {
      closeImageViewer();
      return;
    }

    if (event.key === "Escape" && isUploadModalOpen()) {
      closeUploadModal();
      return;
    }

    if (event.key === "Escape" && elements.folderModal?.classList.contains("open")) {
      closeFolderModal();
    }
  });
}

function openNotebookMode() {
  renderNotebookView();
  elements.notebookMode?.classList.add("open");
  elements.notebookMode?.setAttribute("aria-hidden", "false");
  document.body.classList.add("notebook-open");
  void syncNotebookStateFromServerV4({ silent: true });
  requestAnimationFrame(() => {
    if (state.notebookView === "todo") {
      elements.todoInput?.focus();
      return;
    }

    elements.notebookTextarea?.focus();
  });
}

function closeNotebookMode() {
  persistNotebookDraft();
  persistNotebookTodos();
  void syncNotebookStateToServerV4({ immediate: true, silent: true });
  elements.notebookMode?.classList.remove("open");
  elements.notebookMode?.setAttribute("aria-hidden", "true");
  document.body.classList.remove("notebook-open");
}

function openFolderModal() {
  elements.folderModal?.classList.add("open");
  elements.folderModal?.setAttribute("aria-hidden", "false");
  requestAnimationFrame(() => elements.folderNameInput?.focus());
}

function openUploadModal() {
  elements.uploadModal?.classList.add("open");
  elements.uploadModal?.setAttribute("aria-hidden", "false");
  renderUploadQueue();
  requestAnimationFrame(() => elements.uploadDropzone?.focus());
}

function closeUploadModal({ clearQueue = true, force = false } = {}) {
  if (state.isBusy && !force) {
    return;
  }

  elements.uploadModal?.classList.remove("open");
  elements.uploadModal?.setAttribute("aria-hidden", "true");
  setUploadDropActive(false);

  if (elements.fileInput) {
    elements.fileInput.value = "";
  }

  if (clearQueue) {
    state.uploadQueue = [];
    renderUploadQueue();
  }
}

function closeFolderModal() {
  elements.folderModal?.classList.remove("open");
  elements.folderModal?.setAttribute("aria-hidden", "true");
  elements.folderForm?.reset();
}

function isUploadModalOpen() {
  return elements.uploadModal?.classList.contains("open");
}

function isNotebookOpen() {
  return elements.notebookMode?.classList.contains("open");
}

function createEditorState() {
  return {
    sourceImage: null,
    workingCanvas: null,
    workingContext: null,
    tool: "crop",
    color: EDITOR_DEFAULT_COLOR,
    brushSize: EDITOR_DEFAULT_BRUSH,
    cropStart: null,
    cropRect: null,
    isPointerDown: false,
    lastPoint: null,
    isSaving: false,
  };
}

function openImageViewer(image) {
  state.activePreview = image;

  if (elements.previewImage) {
    elements.previewImage.src = image.url;
    elements.previewImage.alt = image.name || "";
  }

  updateText(elements.previewName, image.name || "");

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

  updateText(elements.previewName, "");
}

function isImageEditorOpen() {
  return elements.imageEditor?.classList.contains("open");
}

function setEditorViewportLockV2(isLocked) {
  document.documentElement.classList.toggle("editor-viewport-locked", isLocked);
  document.body.classList.toggle("editor-viewport-locked", isLocked);
}

async function openImageEditor() {
  if (!state.activePreview || state.isBusy) {
    return;
  }

  try {
    setEditorBusyV2(true);
    const image = await loadImageElement(appendCacheBust(state.activePreview.url, Date.now()));
    prepareImageEditorV2(image);
    syncEditorControlsV2();
    elements.imageEditor?.classList.add("open");
    elements.imageEditor?.setAttribute("aria-hidden", "false");
    requestAnimationFrame(() => {
      renderImageEditor();
      elements.editorCanvas?.focus();
    });
  } catch (error) {
    console.error(error);
    setStatus(error.message || "打開編輯器失敗。", true);
  } finally {
    setEditorBusyV2(false);
  }
}

function closeImageEditor({ force = false } = {}) {
  if (state.editor.isSaving && !force) {
    return;
  }

  elements.imageEditor?.classList.remove("open");
  elements.imageEditor?.setAttribute("aria-hidden", "true");
  state.editor = createEditorStateV2();
  syncEditorControlsV2();

  if (elements.editorCanvas) {
    const context = elements.editorCanvas.getContext("2d");
    context?.clearRect(0, 0, elements.editorCanvas.width, elements.editorCanvas.height);
    elements.editorCanvas.width = 0;
    elements.editorCanvas.height = 0;
  }
}

function prepareImageEditor(image) {
  const workingCanvas = document.createElement("canvas");
  workingCanvas.width = image.naturalWidth;
  workingCanvas.height = image.naturalHeight;

  const workingContext = workingCanvas.getContext("2d");
  if (!workingContext) {
    throw new Error("編輯器初始化失敗。");
  }

  workingContext.drawImage(image, 0, 0);
  state.editor = {
    ...createEditorState(),
    sourceImage: image,
    workingCanvas,
    workingContext,
  };
}

function syncEditorControls() {
  elements.editorCropTool?.classList.toggle("active", state.editor.tool === "crop");
  elements.editorDrawTool?.classList.toggle("active", state.editor.tool === "draw");

  if (elements.editorColor) {
    elements.editorColor.value = state.editor.color;
  }

  if (elements.editorBrushSize) {
    elements.editorBrushSize.value = String(state.editor.brushSize);
  }

  if (elements.applyCropTool) {
    elements.applyCropTool.disabled = !state.editor.cropRect || state.editor.isSaving;
  }
}

function setEditorTool(tool) {
  state.editor.tool = tool;
  state.editor.isPointerDown = false;
  state.editor.lastPoint = null;
  syncEditorControls();
  renderImageEditor();
}

function resetImageEditor() {
  if (!state.editor.sourceImage || state.editor.isSaving) {
    return;
  }

  prepareImageEditor(state.editor.sourceImage);
  syncEditorControls();
  renderImageEditor();
  setStatus("已重設圖片編輯。");
}

function handleEditorColorChange(event) {
  state.editor.color = event.target.value || EDITOR_DEFAULT_COLOR;
}

function handleEditorBrushSizeChange(event) {
  const nextSize = Number(event.target.value);
  state.editor.brushSize = Number.isFinite(nextSize) ? nextSize : EDITOR_DEFAULT_BRUSH;
}

function handleEditorViewportChange() {
  if (!isImageEditorOpen()) {
    return;
  }

  renderImageEditor();
}

function renderImageEditor() {
  if (!elements.editorCanvas || !elements.editorStage || !state.editor.workingCanvas) {
    return;
  }

  const { workingCanvas, cropRect } = state.editor;
  const availableWidth = Math.max(elements.editorStage.clientWidth - 16, 1);
  const availableHeight = Math.max(elements.editorStage.clientHeight - 16, 1);
  const scale = Math.min(
    availableWidth / workingCanvas.width,
    availableHeight / workingCanvas.height,
    1,
  );
  const displayWidth = Math.max(1, Math.round(workingCanvas.width * scale));
  const displayHeight = Math.max(1, Math.round(workingCanvas.height * scale));

  elements.editorCanvas.width = displayWidth;
  elements.editorCanvas.height = displayHeight;
  elements.editorCanvas.style.width = `${displayWidth}px`;
  elements.editorCanvas.style.height = `${displayHeight}px`;

  const context = elements.editorCanvas.getContext("2d");
  if (!context) {
    return;
  }

  context.clearRect(0, 0, displayWidth, displayHeight);
  context.drawImage(workingCanvas, 0, 0, displayWidth, displayHeight);

  if (cropRect && state.editor.tool === "crop") {
    const normalizedRect = normalizeCropRect(cropRect);
    const scaleX = displayWidth / workingCanvas.width;
    const scaleY = displayHeight / workingCanvas.height;
    const left = normalizedRect.x * scaleX;
    const top = normalizedRect.y * scaleY;
    const width = normalizedRect.width * scaleX;
    const height = normalizedRect.height * scaleY;

    context.save();
    context.fillStyle = "rgba(8, 17, 31, 0.42)";
    context.fillRect(0, 0, displayWidth, displayHeight);
    context.clearRect(left, top, width, height);
    context.strokeStyle = "#f5f8ff";
    context.lineWidth = 2;
    context.setLineDash([10, 8]);
    context.strokeRect(left, top, width, height);
    context.restore();
  }
}

function handleEditorPointerDown(event) {
  if (!state.editor.workingCanvas || state.editor.isSaving) {
    return;
  }

  if (event.pointerType === "mouse" && event.button !== 0) {
    return;
  }

  const point = getEditorCanvasPoint(event);
  if (!point) {
    return;
  }

  state.editor.isPointerDown = true;
  elements.editorCanvas?.setPointerCapture?.(event.pointerId);

  if (state.editor.tool === "draw") {
    state.editor.lastPoint = point;
    drawEditorStroke(point, point);
    renderImageEditor();
    return;
  }

  state.editor.cropStart = point;
  state.editor.cropRect = {
    x: point.x,
    y: point.y,
    width: 0,
    height: 0,
  };
  syncEditorControls();
  renderImageEditor();
}

function handleEditorPointerMove(event) {
  if (!state.editor.isPointerDown || !state.editor.workingCanvas) {
    return;
  }

  const point = getEditorCanvasPoint(event);
  if (!point) {
    return;
  }

  if (state.editor.tool === "draw") {
    if (state.editor.lastPoint) {
      drawEditorStroke(state.editor.lastPoint, point);
    }

    state.editor.lastPoint = point;
    renderImageEditor();
    return;
  }

  if (!state.editor.cropStart) {
    return;
  }

  state.editor.cropRect = {
    x: state.editor.cropStart.x,
    y: state.editor.cropStart.y,
    width: point.x - state.editor.cropStart.x,
    height: point.y - state.editor.cropStart.y,
  };
  syncEditorControls();
  renderImageEditor();
}

function handleEditorPointerUp(event) {
  if (!state.editor.isPointerDown) {
    return;
  }

  if (elements.editorCanvas?.hasPointerCapture?.(event.pointerId)) {
    elements.editorCanvas.releasePointerCapture(event.pointerId);
  }

  state.editor.isPointerDown = false;
  state.editor.lastPoint = null;
  state.editor.cropStart = null;

  if (state.editor.cropRect) {
    const normalizedRect = normalizeCropRect(state.editor.cropRect);
    if (normalizedRect.width < 8 || normalizedRect.height < 8) {
      state.editor.cropRect = null;
    }
  }

  syncEditorControls();
  renderImageEditor();
}

function drawEditorStroke(from, to) {
  if (!state.editor.workingContext) {
    return;
  }

  state.editor.workingContext.save();
  state.editor.workingContext.strokeStyle = state.editor.color;
  state.editor.workingContext.lineWidth = state.editor.brushSize;
  state.editor.workingContext.lineCap = "round";
  state.editor.workingContext.lineJoin = "round";
  state.editor.workingContext.beginPath();
  state.editor.workingContext.moveTo(from.x, from.y);
  state.editor.workingContext.lineTo(to.x, to.y);
  state.editor.workingContext.stroke();
  state.editor.workingContext.restore();
}

function applyEditorCrop() {
  if (!state.editor.workingCanvas || !state.editor.cropRect || state.editor.isSaving) {
    return;
  }

  const rect = normalizeCropRect(state.editor.cropRect);
  if (rect.width < 8 || rect.height < 8) {
    setStatus("裁切範圍太小。", true);
    return;
  }

  const nextCanvas = document.createElement("canvas");
  nextCanvas.width = rect.width;
  nextCanvas.height = rect.height;
  const nextContext = nextCanvas.getContext("2d");
  if (!nextContext) {
    setStatus("裁切失敗。", true);
    return;
  }

  nextContext.drawImage(
    state.editor.workingCanvas,
    rect.x,
    rect.y,
    rect.width,
    rect.height,
    0,
    0,
    rect.width,
    rect.height,
  );

  state.editor.workingCanvas = nextCanvas;
  state.editor.workingContext = nextContext;
  state.editor.cropRect = null;
  syncEditorControls();
  renderImageEditor();
  setStatus("已套用裁切。");
}

function getEditorCanvasPoint(event) {
  if (!elements.editorCanvas || !state.editor.workingCanvas) {
    return null;
  }

  const rect = elements.editorCanvas.getBoundingClientRect();
  if (!rect.width || !rect.height) {
    return null;
  }

  const x = ((event.clientX - rect.left) / rect.width) * state.editor.workingCanvas.width;
  const y = ((event.clientY - rect.top) / rect.height) * state.editor.workingCanvas.height;

  return {
    x: clamp(x, 0, state.editor.workingCanvas.width),
    y: clamp(y, 0, state.editor.workingCanvas.height),
  };
}

function normalizeCropRect(rect) {
  return {
    x: Math.round(Math.min(rect.x, rect.x + rect.width)),
    y: Math.round(Math.min(rect.y, rect.y + rect.height)),
    width: Math.round(Math.abs(rect.width)),
    height: Math.round(Math.abs(rect.height)),
  };
}

async function saveImageEditor() {
  if (!state.activePreview || !state.editor.workingCanvas || state.editor.isSaving) {
    return;
  }

  try {
    state.editor.isSaving = true;
    setEditorBusy(true);

    const mimeType = getEditorOutputType(state.activePreview.originalName);
    const editedBlob = await canvasToBlob(state.editor.workingCanvas, mimeType);
    const editedFile = new File([editedBlob], state.activePreview.originalName || "image.png", {
      type: editedBlob.type || mimeType,
    });

    const formData = new FormData();
    formData.set("imageId", state.activePreview.id);
    formData.set("file", editedFile);

    const response = await fetch("/api/images", {
      method: "PUT",
      body: formData,
    });

    const payload = await parseJson(response);
    if (!response.ok) {
      throw new Error(payload.error || "儲存圖片失敗。");
    }

    applyEditedImage(payload.image);
    closeImageEditor({ force: true });
    setStatus("圖片已更新。");
  } catch (error) {
    console.error(error);
    setStatus(error.message || "儲存圖片失敗。", true);
  } finally {
    state.editor.isSaving = false;
    setEditorBusy(false);
  }
}

function applyEditedImage(image) {
  if (!image?.id) {
    return;
  }

  const version = image.updatedAt || Date.now();
  const nextUrl = appendCacheBust(image.url, version);
  const nextThumbnailUrl = appendCacheBust(image.thumbnailUrl || image.url, version);

  state.images = state.images.map((entry) =>
    entry.id === image.id
      ? {
          ...entry,
          url: nextUrl,
          thumbnailUrl: nextThumbnailUrl,
          uploadedAt: image.uploadedAt || entry.uploadedAt,
        }
      : entry,
  );

  if (state.activePreview?.id === image.id) {
    state.activePreview = {
      ...state.activePreview,
      url: nextUrl,
      thumbnailUrl: nextThumbnailUrl,
      uploadedAt: image.uploadedAt || state.activePreview.uploadedAt,
    };

    if (elements.previewImage) {
      elements.previewImage.src = nextUrl;
    }
  }

  saveLibraryCache();
  render();
}

function setEditorBusy(isBusy) {
  if (elements.editPreview) {
    elements.editPreview.disabled = isBusy;
  }

  if (elements.editorCropTool) {
    elements.editorCropTool.disabled = isBusy;
  }

  if (elements.editorDrawTool) {
    elements.editorDrawTool.disabled = isBusy;
  }

  if (elements.applyCropTool) {
    elements.applyCropTool.disabled = isBusy || !state.editor.cropRect;
  }

  if (elements.resetEditor) {
    elements.resetEditor.disabled = isBusy;
  }

  if (elements.editorColor) {
    elements.editorColor.disabled = isBusy;
  }

  if (elements.editorBrushSize) {
    elements.editorBrushSize.disabled = isBusy;
  }

  if (elements.closeEditor) {
    elements.closeEditor.disabled = isBusy;
  }

  if (elements.saveEditor) {
    elements.saveEditor.disabled = isBusy;
  }
}

async function loadImageElement(src) {
  const image = new Image();
  image.decoding = "async";

  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = () => reject(new Error("載入圖片失敗。"));
    image.src = src;
  });

  return image;
}

function canvasToBlob(canvas, mimeType) {
  const quality = mimeType === "image/jpeg" ? 0.92 : undefined;

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("圖片輸出失敗。"));
        return;
      }

      resolve(blob);
    }, mimeType, quality);
  });
}

function getEditorOutputType(fileName) {
  const extension = getFileExtension(fileName || "").toLowerCase();

  if (extension === ".jpg" || extension === ".jpeg") {
    return "image/jpeg";
  }

  if (extension === ".webp") {
    return "image/webp";
  }

  return "image/png";
}

function appendCacheBust(url, value) {
  if (!url) {
    return url;
  }

  try {
    const nextUrl = new URL(url);
    nextUrl.searchParams.set("v", String(value));
    return nextUrl.toString();
  } catch (error) {
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}v=${value}`;
  }
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
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

function handleUploadSelection(event) {
  const files = Array.from(event.target.files ?? []);
  if (elements.fileInput) {
    elements.fileInput.value = "";
  }

  if (files.length === 0) {
    return;
  }

  if (!isUploadModalOpen()) {
    openUploadModal();
  }

  addFilesToUploadQueue(files);
}

function handleUploadDropzoneKeydown(event) {
  if (event.key !== "Enter" && event.key !== " ") {
    return;
  }

  event.preventDefault();
  if (state.isBusy) {
    return;
  }

  elements.fileInput?.click();
}

function handleUploadDragEnter(event) {
  event.preventDefault();
  if (state.isBusy) {
    return;
  }

  setUploadDropActive(true);
}

function handleUploadDragOver(event) {
  event.preventDefault();
  if (state.isBusy) {
    return;
  }

  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = "copy";
  }

  setUploadDropActive(true);
}

function handleUploadDragLeave(event) {
  if (!elements.uploadDropzone) {
    return;
  }

  if (event.currentTarget === event.target || !elements.uploadDropzone.contains(event.relatedTarget)) {
    setUploadDropActive(false);
  }
}

function handleUploadDrop(event) {
  event.preventDefault();
  setUploadDropActive(false);

  if (state.isBusy) {
    return;
  }

  const files = extractImageFiles(event.dataTransfer);
  if (files.length === 0) {
    setStatus("請拖曳圖片檔。", true);
    return;
  }

  addFilesToUploadQueue(files);
}

function handleUploadPaste(event) {
  if (!isUploadModalOpen() || state.isBusy) {
    return;
  }

  const files = extractImageFiles(event.clipboardData);
  if (files.length === 0) {
    return;
  }

  event.preventDefault();
  addFilesToUploadQueue(files);
}

function extractImageFiles(dataTransfer) {
  if (!dataTransfer) {
    return [];
  }

  const files = Array.from(dataTransfer.files ?? []).filter((file) => file.type.startsWith("image/"));
  if (files.length > 0) {
    return files;
  }

  return Array.from(dataTransfer.items ?? [])
    .map((item) => (item.kind === "file" ? item.getAsFile() : null))
    .filter((file) => file && file.type.startsWith("image/"));
}

function addFilesToUploadQueue(files) {
  const accepted = [];
  const existingKeys = new Set(state.uploadQueue.map(getUploadQueueKey));
  let rejectedType = 0;
  let rejectedSize = 0;
  let rejectedDuplicate = 0;

  files.forEach((file) => {
    if (!file.type.startsWith("image/")) {
      rejectedType += 1;
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      rejectedSize += 1;
      return;
    }

    const fileKey = getUploadQueueKey(file);
    if (existingKeys.has(fileKey)) {
      rejectedDuplicate += 1;
      return;
    }

    existingKeys.add(fileKey);
    accepted.push(file);
  });

  if (accepted.length > 0) {
    state.uploadQueue = [...state.uploadQueue, ...accepted];
    renderUploadQueue();
  }

  if (accepted.length === 0) {
    if (rejectedSize > 0) {
      setStatus("圖片超過 4.5 MB，沒有加入上傳清單。", true);
      return;
    }

    if (rejectedType > 0) {
      setStatus("只能加入圖片檔。", true);
      return;
    }

    if (rejectedDuplicate > 0) {
      setStatus("這些圖片已經在上傳清單裡了。", true);
    }

    return;
  }

  const notices = [`已加入 ${accepted.length} 張圖片。`];
  if (rejectedDuplicate > 0) {
    notices.push(`略過 ${rejectedDuplicate} 張重複圖片。`);
  }

  if (rejectedSize > 0) {
    notices.push(`略過 ${rejectedSize} 張超過 4.5 MB 的圖片。`);
  }

  if (rejectedType > 0) {
    notices.push(`略過 ${rejectedType} 個非圖片檔案。`);
  }

  setStatus(notices.join(" "));
}

function handleNotebookInput() {
  if (state.notebookSaveTimer) {
    window.clearTimeout(state.notebookSaveTimer);
  }

  state.notebookSaveTimer = window.setTimeout(() => {
    persistNotebookDraft();
    queueNotebookSyncV4();
  }, 160);
}

function persistNotebookDraft() {
  if (state.notebookSaveTimer) {
    window.clearTimeout(state.notebookSaveTimer);
    state.notebookSaveTimer = 0;
  }

  if (!elements.notebookTextarea) {
    return;
  }

  localStorage.setItem(NOTEBOOK_CONTENT_KEY, elements.notebookTextarea.value);
}

function handleNotebookBlurV4() {
  persistNotebookDraft();
  queueNotebookSyncV4({ immediate: true });
}

function persistNotebookTodos() {
  localStorage.setItem(NOTEBOOK_TODOS_KEY, JSON.stringify(state.notebookTodos));
}

function restoreNotebookState() {
  if (elements.notebookTextarea) {
    elements.notebookTextarea.value = localStorage.getItem(NOTEBOOK_CONTENT_KEY) || "";
  }

  const savedView = localStorage.getItem(NOTEBOOK_VIEW_KEY);
  if (savedView === "todo") {
    state.notebookView = "todo";
  }

  try {
    const parsedTodos = JSON.parse(localStorage.getItem(NOTEBOOK_TODOS_KEY) || "[]");
    state.notebookTodos = Array.isArray(parsedTodos)
      ? parsedTodos
          .filter((item) => item && typeof item.text === "string")
          .map((item) => ({
            id: String(item.id || crypto.randomUUID()),
            text: item.text.trim(),
            price: normalizeTodoPrice(item.price),
            done: Boolean(item.done),
          }))
          .filter((item) => item.text)
      : [];
  } catch (error) {
    console.error(error);
    state.notebookTodos = [];
  }

  renderNotebookView();
}

function setNotebookView(view) {
  state.notebookView = view === "todo" ? "todo" : "notes";
  localStorage.setItem(NOTEBOOK_VIEW_KEY, state.notebookView);
  renderNotebookView();
}

function renderNotebookView() {
  const showTodo = state.notebookView === "todo";

  elements.showNotebookNotes?.classList.toggle("active", !showTodo);
  elements.showNotebookTodo?.classList.toggle("active", showTodo);
  elements.showNotebookNotes?.setAttribute("aria-selected", String(!showTodo));
  elements.showNotebookTodo?.setAttribute("aria-selected", String(showTodo));

  if (elements.notebookNotesPanel) {
    elements.notebookNotesPanel.hidden = showTodo;
    elements.notebookNotesPanel.classList.toggle("active", !showTodo);
  }

  if (elements.notebookTodoPanel) {
    elements.notebookTodoPanel.hidden = !showTodo;
    elements.notebookTodoPanel.classList.toggle("active", showTodo);
  }

  renderTodoListV4();
}

function handleTodoSubmit(event) {
  event.preventDefault();

  const text = elements.todoInput?.value.trim() || "";
  const price = normalizeTodoPrice(elements.todoPriceInput?.value);
  if (!text) {
    return;
  }

  state.notebookTodos = [
    {
      id: crypto.randomUUID(),
      text,
      price,
      done: false,
    },
    ...state.notebookTodos,
  ];

  if (elements.todoInput) {
    elements.todoInput.value = "";
    elements.todoInput.focus();
  }

  if (elements.todoPriceInput) {
    elements.todoPriceInput.value = "";
  }

  persistNotebookTodos();
  queueNotebookSyncV4();
  renderTodoListV4();
}

function handleTodoListClick(event) {
  const editButton = event.target.closest("[data-edit-todo]");
  if (editButton) {
    handleTodoEditV4(editButton.getAttribute("data-edit-todo"));
    return;
  }

  const deleteButton = event.target.closest("[data-delete-todo]");
  if (!deleteButton) {
    return;
  }

  const todoId = deleteButton.getAttribute("data-delete-todo");
  state.notebookTodos = state.notebookTodos.filter((item) => item.id !== todoId);
  persistNotebookTodos();
  queueNotebookSyncV4();
  renderTodoListV4();
}

function handleTodoListChange(event) {
  const checkbox = event.target.closest("[data-toggle-todo]");
  if (!checkbox) {
    return;
  }

  const todoId = checkbox.getAttribute("data-toggle-todo");
  state.notebookTodos = state.notebookTodos.map((item) =>
    item.id === todoId
      ? {
          ...item,
          done: checkbox.checked,
        }
      : item,
  );

  persistNotebookTodos();
  queueNotebookSyncV4();
  renderTodoListV4();
}

function renderTodoList() {
  if (!elements.todoList) {
    return;
  }

  elements.todoList.innerHTML = "";

  if (state.notebookTodos.length === 0) {
    const emptyState = document.createElement("p");
    emptyState.className = "todo-empty";
    emptyState.textContent = "還沒有待辦事項。";
    elements.todoList.append(emptyState);
    return;
  }

  state.notebookTodos.forEach((item) => {
    const row = document.createElement("div");
    row.className = `todo-item${item.done ? " done" : ""}`;

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "todo-item-checkbox";
    checkbox.checked = item.done;
    checkbox.setAttribute("data-toggle-todo", item.id);
    checkbox.setAttribute("aria-label", `切換 ${item.text}`);

    const label = document.createElement("span");
    label.className = "todo-item-label";
    label.textContent = item.text;

    const price = document.createElement("span");
    price.className = "todo-item-price";
    price.textContent = item.price || "-";

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "todo-item-delete";
    deleteButton.setAttribute("data-delete-todo", item.id);
    deleteButton.setAttribute("aria-label", `刪除 ${item.text}`);
    deleteButton.textContent = "×";

    row.append(checkbox, label, price, deleteButton);
    elements.todoList?.append(row);
  });
}

function normalizeTodoPrice(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ");
}

function restoreNotebookStateV2() {
  if (elements.notebookTextarea) {
    elements.notebookTextarea.value = localStorage.getItem(NOTEBOOK_CONTENT_KEY) || "";
  }

  const savedView = localStorage.getItem(NOTEBOOK_VIEW_KEY);
  if (savedView === "todo") {
    state.notebookView = "todo";
  }

  state.notebookTodos = loadStoredNotebookTodosV2();
  renderNotebookView();
}

function renderTodoListV2() {
  if (!elements.todoList) {
    return;
  }

  elements.todoList.innerHTML = "";

  if (state.notebookTodos.length === 0) {
    const emptyState = document.createElement("p");
    emptyState.className = "todo-empty";
    emptyState.textContent = "還沒有待辦事項。";
    elements.todoList.append(emptyState);
    return;
  }

  state.notebookTodos.forEach((item) => {
    const row = document.createElement("div");
    row.className = `todo-item${item.done ? " done" : ""}`;

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "todo-item-checkbox";
    checkbox.checked = item.done;
    checkbox.setAttribute("data-toggle-todo", item.id);
    checkbox.setAttribute("aria-label", `切換 ${item.text}`);

    const label = document.createElement("span");
    label.className = "todo-item-label";
    label.textContent = item.text;

    const price = document.createElement("span");
    price.className = "todo-item-price";
    price.textContent = item.price || "-";

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "todo-item-delete";
    deleteButton.setAttribute("data-delete-todo", item.id);
    deleteButton.setAttribute("aria-label", `刪除 ${item.text}`);
    deleteButton.textContent = "×";

    row.append(checkbox, label, price, deleteButton);
    elements.todoList.append(row);
  });
}

function loadStoredNotebookTodosV2() {
  for (const key of LEGACY_NOTEBOOK_TODO_KEYS) {
    const raw = localStorage.getItem(key);
    if (!raw) {
      continue;
    }

    try {
      const parsed = JSON.parse(raw);
      const items = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.items) ? parsed.items : [];
      const normalized = items.map(normalizeStoredTodoItemV2).filter(Boolean);

      if (normalized.length > 0) {
        return normalized;
      }
    } catch (error) {
      console.error(error);
    }
  }

  return [];
}

function normalizeStoredTodoItemV2(item) {
  if (typeof item === "string") {
    const text = item.trim();
    if (!text) {
      return null;
    }

    return {
      id: crypto.randomUUID(),
      text,
      price: "",
      done: false,
    };
  }

  if (!item || typeof item !== "object") {
    return null;
  }

  const textSource = item.text ?? item.label ?? item.title ?? item.content ?? "";
  const text = String(textSource).trim();
  if (!text) {
    return null;
  }

  return {
    id: String(item.id || crypto.randomUUID()),
    text,
    price: normalizeTodoPrice(item.price ?? item.amount ?? item.value ?? ""),
    done: Boolean(item.done ?? item.checked ?? item.completed),
  };
}

function renderTodoListV3() {
  if (!elements.todoList) {
    return;
  }

  renderTodoSummaryV3();
  elements.todoList.innerHTML = "";

  if (state.notebookTodos.length === 0) {
    const emptyState = document.createElement("p");
    emptyState.className = "todo-empty";
    emptyState.textContent = "還沒有待辦事項。";
    elements.todoList.append(emptyState);
    return;
  }

  state.notebookTodos.forEach((item) => {
    const row = document.createElement("div");
    row.className = `todo-item${item.done ? " done" : ""}`;

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "todo-item-checkbox";
    checkbox.checked = item.done;
    checkbox.setAttribute("data-toggle-todo", item.id);
    checkbox.setAttribute("aria-label", `切換 ${item.text}`);

    const label = document.createElement("span");
    label.className = "todo-item-label";
    label.textContent = item.text;

    const price = document.createElement("span");
    price.className = "todo-item-price";
    price.textContent = item.price || "-";

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "todo-item-delete";
    deleteButton.setAttribute("data-delete-todo", item.id);
    deleteButton.setAttribute("aria-label", `刪除 ${item.text}`);
    deleteButton.textContent = "×";

    row.append(checkbox, label, price, deleteButton);
    elements.todoList.append(row);
  });
}

function renderTodoSummaryV3() {
  const totalAmount = state.notebookTodos.reduce((sum, item) => sum + getTodoNumericPriceV3(item.price), 0);
  const openAmount = state.notebookTodos.reduce(
    (sum, item) => sum + (item.done ? 0 : getTodoNumericPriceV3(item.price)),
    0,
  );

  updateText(elements.todoTotalAmount, formatTodoAmountV3(totalAmount));
  updateText(elements.todoOpenAmount, formatTodoAmountV3(openAmount));
}

function getTodoNumericPriceV3(value) {
  const normalized = String(value || "")
    .replace(/,/g, "")
    .replace(/[^\d.-]/g, "");
  const amount = Number(normalized);

  return Number.isFinite(amount) ? amount : 0;
}

function formatTodoAmountV3(value) {
  const formatter = Number.isInteger(value)
    ? new Intl.NumberFormat("zh-TW", { maximumFractionDigits: 0 })
    : new Intl.NumberFormat("zh-TW", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

  return formatter.format(value);
}

async function syncNotebookStateFromServerV4({ silent = false } = {}) {
  const response = await fetch("/api/notebook", {
    cache: "no-store",
  });
  const payload = await parseJson(response);

  if (!response.ok) {
    throw new Error(payload.error || "記事本同步失敗。");
  }

  const notebook = normalizeNotebookStateV4(payload.notebook);
  const localNotebook = buildNotebookStatePayloadV4();

  if (isNotebookStateEmptyV4(notebook) && !isNotebookStateEmptyV4(localNotebook)) {
    await syncNotebookStateToServerV4({ immediate: true, silent: true });
    return;
  }

  applyNotebookStateV4(notebook);

  if (!silent && isNotebookOpen()) {
    setStatus("記事本已同步。");
  }
}

function applyNotebookStateV4(notebook) {
  const normalized = normalizeNotebookStateV4(notebook);
  state.notebookTodos = normalized.todos;

  if (elements.notebookTextarea) {
    elements.notebookTextarea.value = normalized.content;
  }

  localStorage.setItem(NOTEBOOK_CONTENT_KEY, normalized.content);
  localStorage.setItem(NOTEBOOK_TODOS_KEY, JSON.stringify(normalized.todos));
  renderNotebookView();
}

function buildNotebookStatePayloadV4() {
  return {
    content: elements.notebookTextarea?.value || "",
    todos: state.notebookTodos.map((item) => ({
      id: item.id,
      text: item.text,
      price: normalizeTodoPrice(item.price),
      done: Boolean(item.done),
    })),
  };
}

function normalizeNotebookStateV4(notebook) {
  const source = notebook && typeof notebook === "object" ? notebook : {};
  const todos = Array.isArray(source.todos) ? source.todos.map(normalizeStoredTodoItemV2).filter(Boolean) : [];

  return {
    content: typeof source.content === "string" ? source.content : "",
    todos,
  };
}

function isNotebookStateEmptyV4(notebook) {
  return !notebook.content.trim() && notebook.todos.length === 0;
}

function queueNotebookSyncV4({ immediate = false } = {}) {
  if (state.notebookSyncTimer) {
    window.clearTimeout(state.notebookSyncTimer);
    state.notebookSyncTimer = 0;
  }

  if (immediate) {
    void syncNotebookStateToServerV4({ immediate: true, silent: true });
    return;
  }

  state.notebookSyncTimer = window.setTimeout(() => {
    state.notebookSyncTimer = 0;
    void syncNotebookStateToServerV4({ silent: true });
  }, 260);
}

async function syncNotebookStateToServerV4({ immediate = false, silent = false } = {}) {
  if (!immediate && state.notebookSyncTimer) {
    window.clearTimeout(state.notebookSyncTimer);
    state.notebookSyncTimer = 0;
  }

  if (state.isNotebookSyncing) {
    state.isNotebookSyncQueued = true;
    return;
  }

  state.isNotebookSyncing = true;

  try {
    const response = await fetch("/api/notebook", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildNotebookStatePayloadV4()),
    });
    const payload = await parseJson(response);

    if (!response.ok) {
      throw new Error(payload.error || "記事本同步失敗。");
    }

    applyNotebookStateV4(payload.notebook);
  } catch (error) {
    console.error(error);
    if (!silent) {
      setStatus(error.message || "記事本同步失敗。", true);
    }
  } finally {
    state.isNotebookSyncing = false;

    if (state.isNotebookSyncQueued) {
      state.isNotebookSyncQueued = false;
      void syncNotebookStateToServerV4({ silent: true });
    }
  }
}

function flushNotebookSyncV4() {
  persistNotebookDraft();
  persistNotebookTodos();

  if (state.notebookSyncTimer) {
    window.clearTimeout(state.notebookSyncTimer);
    state.notebookSyncTimer = 0;
  }

  if (typeof fetch !== "function") {
    return;
  }

  void fetch("/api/notebook", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(buildNotebookStatePayloadV4()),
    keepalive: true,
  }).catch((error) => {
    console.error(error);
  });
}

function handleTodoEditV4(todoId) {
  if (!todoId) {
    return;
  }

  const target = state.notebookTodos.find((item) => item.id === todoId);
  if (!target) {
    return;
  }

  const nextText = window.prompt("編輯項目", target.text);
  if (nextText === null) {
    return;
  }

  const normalizedText = nextText.trim();
  if (!normalizedText) {
    setStatus("待辦項目不能是空的。", true);
    return;
  }

  const nextPrice = window.prompt("編輯價格", target.price || "");
  if (nextPrice === null) {
    return;
  }

  state.notebookTodos = state.notebookTodos.map((item) =>
    item.id === todoId
      ? {
          ...item,
          text: normalizedText,
          price: normalizeTodoPrice(nextPrice),
        }
      : item,
  );

  persistNotebookTodos();
  queueNotebookSyncV4();
  renderTodoListV4();
}

function renderTodoListV4() {
  if (!elements.todoList) {
    return;
  }

  renderTodoSummaryV4();
  elements.todoList.innerHTML = "";

  if (state.notebookTodos.length === 0) {
    const emptyState = document.createElement("p");
    emptyState.className = "todo-empty";
    emptyState.textContent = "還沒有待辦事項。";
    elements.todoList.append(emptyState);
    return;
  }

  state.notebookTodos.forEach((item) => {
    const row = document.createElement("div");
    row.className = `todo-item${item.done ? " done" : ""}`;

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "todo-item-checkbox";
    checkbox.checked = item.done;
    checkbox.setAttribute("data-toggle-todo", item.id);
    checkbox.setAttribute("aria-label", `切換 ${item.text}`);

    const label = document.createElement("span");
    label.className = "todo-item-label";
    label.textContent = item.text;

    const price = document.createElement("span");
    price.className = "todo-item-price";
    price.textContent = item.price || "-";

    const actions = document.createElement("div");
    actions.className = "todo-item-actions";

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "todo-item-edit";
    editButton.setAttribute("data-edit-todo", item.id);
    editButton.setAttribute("aria-label", `編輯 ${item.text}`);
    editButton.textContent = "編輯";

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "todo-item-delete";
    deleteButton.setAttribute("data-delete-todo", item.id);
    deleteButton.setAttribute("aria-label", `刪除 ${item.text}`);
    deleteButton.textContent = "×";

    actions.append(editButton, deleteButton);
    row.append(checkbox, label, price, actions);
    elements.todoList.append(row);
  });
}

function renderTodoSummaryV4() {
  const totalAmount = state.notebookTodos.reduce((sum, item) => sum + getTodoNumericPriceV4(item.price), 0);
  const openAmount = state.notebookTodos.reduce(
    (sum, item) => sum + (item.done ? 0 : getTodoNumericPriceV4(item.price)),
    0,
  );

  updateText(elements.todoTotalAmount, formatTodoAmountV4(totalAmount));
  updateText(elements.todoOpenAmount, formatTodoAmountV4(openAmount));
}

function getTodoNumericPriceV4(value) {
  const normalized = String(value || "")
    .replace(/,/g, "")
    .replace(/[^\d.-]/g, "");
  const amount = Number(normalized);

  return Number.isFinite(amount) ? amount : 0;
}

function formatTodoAmountV4(value) {
  const formatter = Number.isInteger(value)
    ? new Intl.NumberFormat("zh-TW", { maximumFractionDigits: 0 })
    : new Intl.NumberFormat("zh-TW", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

  return formatter.format(value);
}

function getUploadQueueKey(file) {
  return [file.name, file.size, file.lastModified].join("::");
}

function renderUploadQueue() {
  if (!elements.uploadQueue || !elements.submitUploadQueue) {
    return;
  }

  const files = state.uploadQueue;
  elements.uploadQueue.hidden = files.length === 0;
  elements.submitUploadQueue.disabled = files.length === 0 || state.isBusy;
  elements.submitUploadQueue.setAttribute("aria-disabled", String(files.length === 0 || state.isBusy));

  elements.uploadQueue.innerHTML = "";
  if (files.length === 0) {
    return;
  }

  const summary = document.createElement("p");
  summary.className = "upload-queue-summary";
  summary.textContent = `已加入 ${files.length} 張圖片`;
  elements.uploadQueue.append(summary);

  const list = document.createElement("div");
  list.className = "upload-queue-list";

  files.forEach((file, index) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "upload-queue-chip";
    chip.textContent = file.name;
    chip.title = `移除 ${file.name}`;
    chip.addEventListener("click", () => removeUploadQueueFile(index));
    list.append(chip);
  });

  elements.uploadQueue.append(list);
}

function removeUploadQueueFile(index) {
  state.uploadQueue = state.uploadQueue.filter((_, queuedIndex) => queuedIndex !== index);
  renderUploadQueue();
}

async function handleUploadQueueSubmit() {
  if (state.isBusy) {
    return;
  }

  if (state.uploadQueue.length === 0) {
    setStatus("先加入至少一張圖片。", true);
    return;
  }

  const targetFolder = getUploadFolder();
  if (!targetFolder) {
    setStatus("找不到上傳目標資料夾。", true);
    return;
  }

  try {
    setBusy(true);

    let completed = 0;
    for (const file of state.uploadQueue) {
      completed += 1;
      setStatus(`上傳圖片 ${completed}/${state.uploadQueue.length}`);
      await uploadSingleFile(file, targetFolder.id);
    }

    await refreshLibrary(state.selectedFolderId);
    setStatus(`已上傳 ${state.uploadQueue.length} 張圖片。`);
    closeUploadModal({ force: true });
  } catch (error) {
    console.error(error);
    setStatus(error.message || "上傳失敗。", true);
  } finally {
    setBusy(false);
    renderUploadQueue();
  }
}

function setUploadDropActive(isActive) {
  elements.uploadDropzone?.classList.toggle("drag-active", isActive);
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

  if (state.selectedFolderId) {
    const homeButton = document.createElement("button");
    homeButton.type = "button";
    homeButton.className = "folder-pill folder-pill-home";
    homeButton.setAttribute("aria-label", "返回首頁");

    const art = document.createElement("span");
    art.className = "folder-art";
    art.setAttribute("aria-hidden", "true");
    art.innerHTML = getHomeIconMarkup();
    homeButton.append(art);

    const label = document.createElement("strong");
    label.textContent = "返回首頁";
    homeButton.append(label);

    homeButton.addEventListener("click", () => {
      if (state.isBusy) {
        return;
      }

      state.selectedFolderId = null;
      saveSelectedFolder();
      render();
      setStatus("全部圖片");
    });

    elements.folderList.append(homeButton);
  }

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

  const images = getVisibleImages();

  elements.galleryGrid.innerHTML = "";
  elements.galleryStage.hidden = images.length === 0;

  images.forEach((image) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "gallery-item";
    button.setAttribute("aria-label", image.name || "開啟圖片");
    button.title = image.name || "";

    const media = document.createElement("span");
    media.className = "gallery-media";

    const img = document.createElement("img");
    img.src = image.thumbnailUrl || image.url;
    img.alt = "";
    img.loading = "lazy";
    img.decoding = "async";

    const label = document.createElement("span");
    label.className = "gallery-name";
    label.textContent = image.name || "";

    button.addEventListener("click", () => openImageViewer(image));
    media.append(img);
    button.append(media, label);
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

function getVisibleImages() {
  const activeFolderId = state.selectedFolderId || getRootFolder()?.id || ROOT_FOLDER_ID;
  return state.images.filter((image) => image.folderId === activeFolderId);
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

  if (elements.closeUploadModal) {
    elements.closeUploadModal.disabled = isBusy;
  }

  if (elements.chooseUploadFiles) {
    elements.chooseUploadFiles.disabled = isBusy;
  }

  if (elements.submitUploadQueue) {
    elements.submitUploadQueue.disabled = isBusy || state.uploadQueue.length === 0;
  }

  if (elements.uploadDropzone) {
    elements.uploadDropzone.setAttribute("aria-disabled", String(isBusy));
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

  renderUploadQueue();
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
    link.download = getDownloadFileName(state.activePreview);
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

async function handleRenamePreviewFast() {
  if (!state.activePreview) {
    return;
  }

  const imageId = state.activePreview.id;
  const previousName = state.activePreview.name || "";
  const nextName = window.prompt("重新命名圖片", previousName);
  if (nextName === null) {
    return;
  }

  const normalizedName = normalizeImageName(nextName);
  if (!normalizedName) {
    setStatus("圖片名稱不能是空的。", true);
    return;
  }

  if (normalizedName === previousName) {
    return;
  }

  try {
    setViewerBusy(true);
    applyRenamedImage(imageId, normalizedName);

    const response = await fetch("/api/images", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        imageId,
        name: normalizedName,
      }),
    });

    const payload = await parseJson(response);
    if (!response.ok) {
      throw new Error(payload.error || "重新命名失敗。");
    }

    const confirmedName = payload.image?.name || normalizedName;
    if (confirmedName !== normalizedName) {
      applyRenamedImage(imageId, confirmedName);
    }

    setStatus(`圖片已重新命名為 ${confirmedName}。`);
  } catch (error) {
    applyRenamedImage(imageId, previousName);
    console.error(error);
    setStatus(error.message || "重新命名失敗。", true);
  } finally {
    setViewerBusy(false);
  }
}

async function handleRenamePreview() {
  if (!state.activePreview) {
    return;
  }

  const nextName = window.prompt("輸入圖片名稱", state.activePreview.name || "");
  if (nextName === null) {
    return;
  }

  const normalizedName = normalizeImageName(nextName);
  if (!normalizedName) {
    setStatus("圖片名稱不能是空的。", true);
    return;
  }

  try {
    setViewerBusy(true);

    const response = await fetch("/api/images", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        imageId: state.activePreview.id,
        name: normalizedName,
      }),
    });

    const payload = await parseJson(response);
    if (!response.ok) {
      throw new Error(payload.error || "重新命名失敗。");
    }

    applyRenamedImage(payload.image.id, payload.image.name);
    setStatus(`圖片已重新命名為 ${payload.image.name}。`);
  } catch (error) {
    console.error(error);
    setStatus(error.message || "重新命名失敗。", true);
  } finally {
    setViewerBusy(false);
  }
}

async function handleDeletePreview() {
  if (!state.activePreview) {
    return;
  }

  const image = state.activePreview;
  const imageLabel = image.name || "這張圖片";
  const confirmed = window.confirm(`確定要刪除「${imageLabel}」嗎？這個動作不能復原。`);
  if (!confirmed) {
    return;
  }

  try {
    setViewerBusy(true);

    const response = await fetch("/api/images", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        imageId: image.id,
      }),
    });

    const payload = await parseJson(response);
    if (!response.ok) {
      throw new Error(payload.error || "刪除圖片失敗。");
    }

    removeImageFromState(image.id);
    closeImageViewer();
    setStatus(`已刪除 ${imageLabel}`);
  } catch (error) {
    console.error(error);
    setStatus(error.message || "刪除圖片失敗。", true);
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
  if (elements.editPreview) {
    elements.editPreview.disabled = isBusy;
  }

  if (elements.renamePreview) {
    elements.renamePreview.disabled = isBusy;
  }

  if (elements.downloadPreview) {
    elements.downloadPreview.disabled = isBusy;
  }

  if (elements.copyPreview) {
    elements.copyPreview.disabled = isBusy;
  }

  if (elements.deletePreview) {
    elements.deletePreview.disabled = isBusy;
  }
}

function applyRenamedImage(imageId, name) {
  state.images = state.images.map((image) => (image.id === imageId ? { ...image, name } : image));

  if (state.activePreview?.id === imageId) {
    state.activePreview = {
      ...state.activePreview,
      name,
    };

    if (elements.previewImage) {
      elements.previewImage.alt = name;
    }

    updateText(elements.previewName, name);
  }

  saveLibraryCache();
  render();
}

function removeImageFromState(imageId) {
  state.images = state.images.filter((image) => image.id !== imageId);
  syncFolderImageCounts();
  saveLibraryCache();
  render();
}

function syncFolderImageCounts() {
  const imageCountByFolder = new Map();

  state.images.forEach((image) => {
    imageCountByFolder.set(image.folderId, (imageCountByFolder.get(image.folderId) || 0) + 1);
  });

  state.folders = state.folders.map((folder) => ({
    ...folder,
    imageCount: imageCountByFolder.get(folder.id) || 0,
  }));
}

function getDownloadFileName(image) {
  const baseName = normalizeImageName(image.name || "") || "image";
  const extension = getFileExtension(image.originalName || "");

  if (!extension || baseName.toLowerCase().endsWith(extension.toLowerCase())) {
    return baseName;
  }

  return `${baseName}${extension}`;
}

function getFileExtension(fileName) {
  const lastDotIndex = fileName.lastIndexOf(".");
  if (lastDotIndex <= 0) {
    return "";
  }

  return fileName.slice(lastDotIndex);
}

function normalizeImageName(name) {
  return name.trim().replace(/\s+/g, " ");
}

function getFolderIconMarkup() {
  return `
    <svg viewBox="0 0 120 120" class="line-icon">
      <path d="M16 42c0-6 5-11 11-11h22l9 10h35c6 0 11 5 11 11v33c0 8-6 14-14 14H30c-8 0-14-6-14-14V42z" />
      <path d="M16 49h88" />
    </svg>
  `;
}

function getHomeIconMarkup() {
  return `
    <svg viewBox="0 0 120 120" class="line-icon">
      <path d="M24 55l36-29 36 29" />
      <path d="M35 49v42h50V49" />
      <path d="M51 91V63h18v28" />
    </svg>
  `;
}

function createEditorStateV2() {
  return {
    sourceCanvas: null,
    workingCanvas: null,
    workingContext: null,
    tool: "crop",
    color: EDITOR_DEFAULT_COLOR,
    brushSize: EDITOR_DEFAULT_BRUSH,
    cropStart: null,
    cropRect: null,
    isPointerDown: false,
    lastPoint: null,
    strokeDirty: false,
    history: [],
    historyIndex: -1,
    renderFrame: 0,
    isSaving: false,
  };
}

async function openImageEditorV2() {
  if (!state.activePreview || state.isBusy) {
    return;
  }

  try {
    setEditorBusyV2(true);
    const image = await loadImageElement(appendCacheBust(state.activePreview.url, Date.now()));
    prepareImageEditorV2(image);
    syncEditorControlsV2();
    elements.imageEditor?.classList.add("open");
    elements.imageEditor?.setAttribute("aria-hidden", "false");
    setEditorViewportLockV2(true);
    requestAnimationFrame(() => {
      scheduleRenderImageEditorV2();
      elements.editorCanvas?.focus();
    });
  } catch (error) {
    console.error(error);
    setStatus(error.message || "開啟編輯器失敗。", true);
  } finally {
    setEditorBusyV2(false);
  }
}

function closeImageEditorV2({ force = false } = {}) {
  if (state.editor.isSaving && !force) {
    return;
  }

  if (state.editor.renderFrame) {
    cancelAnimationFrame(state.editor.renderFrame);
  }

  elements.imageEditor?.classList.remove("open");
  elements.imageEditor?.setAttribute("aria-hidden", "true");
  setEditorViewportLockV2(false);
  state.editor = createEditorStateV2();
  syncEditorControlsV2();

  if (elements.editorCanvas) {
    const context = elements.editorCanvas.getContext("2d");
    context?.clearRect(0, 0, elements.editorCanvas.width, elements.editorCanvas.height);
    elements.editorCanvas.width = 0;
    elements.editorCanvas.height = 0;
  }
}

function prepareImageEditorV2(image) {
  const sourceCanvas = createScaledEditorCanvasV2(image);
  if (!sourceCanvas) {
    throw new Error("編輯器初始化失敗。");
  }

  state.editor = {
    ...createEditorStateV2(),
    sourceCanvas,
  };

  setEditorWorkingCanvasV2(cloneEditorCanvasV2(sourceCanvas), { pushHistory: true });
}

function syncEditorControlsV2() {
  elements.editorCropTool?.classList.toggle("active", state.editor.tool === "crop");
  elements.editorDrawTool?.classList.toggle("active", state.editor.tool === "draw");
  elements.editorEraserTool?.classList.toggle("active", state.editor.tool === "erase");

  if (elements.editorColor) {
    elements.editorColor.value = state.editor.color;
  }

  if (elements.editorBrushSize) {
    elements.editorBrushSize.value = String(state.editor.brushSize);
  }

  if (elements.applyCropTool) {
    elements.applyCropTool.disabled = state.editor.isSaving || !state.editor.cropRect;
  }

  if (elements.editorUndo) {
    elements.editorUndo.disabled = state.editor.isSaving || state.editor.historyIndex <= 0;
  }

  if (elements.editorRedo) {
    elements.editorRedo.disabled =
      state.editor.isSaving || state.editor.historyIndex >= state.editor.history.length - 1;
  }

  if (elements.editorHint) {
    elements.editorHint.textContent = getEditorHintTextV2();
  }
}

function setEditorToolV2(tool) {
  state.editor.tool = tool;
  state.editor.isPointerDown = false;
  state.editor.lastPoint = null;
  state.editor.cropStart = null;

  if (tool !== "crop") {
    state.editor.cropRect = null;
  }

  syncEditorControlsV2();
  scheduleRenderImageEditorV2();
}

function resetImageEditorV2() {
  if (!state.editor.sourceCanvas || state.editor.isSaving) {
    return;
  }

  state.editor.cropRect = null;
  setEditorWorkingCanvasV2(cloneEditorCanvasV2(state.editor.sourceCanvas), { pushHistory: true });
  syncEditorControlsV2();
  scheduleRenderImageEditorV2();
  setStatus("已重設編輯內容。");
}

function handleEditorViewportChangeV2() {
  if (!isImageEditorOpen()) {
    return;
  }

  scheduleRenderImageEditorV2();
}

function blockEditorGestureV2(event) {
  if (!isImageEditorOpen()) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
}

function handleEditorWheelZoomV2(event) {
  if (!isImageEditorOpen()) {
    return;
  }

  const target = event.target instanceof Node ? event.target : null;
  const isInsideEditor = Boolean(target && elements.imageEditor?.contains(target));

  if (isInsideEditor || event.ctrlKey || event.metaKey) {
    event.preventDefault();
    event.stopPropagation();
  }
}

function renderImageEditorV2() {
  if (!elements.editorCanvas || !elements.editorStage || !state.editor.workingCanvas) {
    return;
  }

  const { workingCanvas, cropRect } = state.editor;
  const availableWidth = Math.max(elements.editorStage.clientWidth - 24, 1);
  const availableHeight = Math.max(elements.editorStage.clientHeight - 24, 1);
  const scale = Math.min(
    availableWidth / workingCanvas.width,
    availableHeight / workingCanvas.height,
    1,
  );
  const displayWidth = Math.max(1, Math.round(workingCanvas.width * scale));
  const displayHeight = Math.max(1, Math.round(workingCanvas.height * scale));

  elements.editorCanvas.width = displayWidth;
  elements.editorCanvas.height = displayHeight;
  elements.editorCanvas.style.width = `${displayWidth}px`;
  elements.editorCanvas.style.height = `${displayHeight}px`;

  const context = elements.editorCanvas.getContext("2d");
  if (!context) {
    return;
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "medium";
  context.clearRect(0, 0, displayWidth, displayHeight);
  context.drawImage(workingCanvas, 0, 0, displayWidth, displayHeight);

  if (cropRect && state.editor.tool === "crop") {
    const normalizedRect = normalizeCropRect(cropRect);
    const scaleX = displayWidth / workingCanvas.width;
    const scaleY = displayHeight / workingCanvas.height;
    const left = normalizedRect.x * scaleX;
    const top = normalizedRect.y * scaleY;
    const width = normalizedRect.width * scaleX;
    const height = normalizedRect.height * scaleY;

    context.save();
    context.fillStyle = "rgba(11, 18, 32, 0.46)";
    context.fillRect(0, 0, displayWidth, displayHeight);
    context.clearRect(left, top, width, height);
    context.strokeStyle = "#f5f8ff";
    context.lineWidth = 2;
    context.setLineDash([10, 8]);
    context.strokeRect(left, top, width, height);
    context.restore();
  }
}

function scheduleRenderImageEditorV2() {
  if (!isImageEditorOpen() || state.editor.renderFrame) {
    return;
  }

  state.editor.renderFrame = requestAnimationFrame(() => {
    state.editor.renderFrame = 0;
    renderImageEditorV2();
  });
}

function handleEditorPointerDownV2(event) {
  if (!state.editor.workingCanvas || state.editor.isSaving) {
    return;
  }

  if (event.pointerType === "mouse" && event.button !== 0) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  const point = getEditorCanvasPoint(event);
  if (!point) {
    return;
  }

  state.editor.isPointerDown = true;
  elements.editorCanvas?.setPointerCapture?.(event.pointerId);

  if (state.editor.tool === "draw" || state.editor.tool === "erase") {
    state.editor.lastPoint = point;
    state.editor.strokeDirty = true;
    drawEditorStrokeV2(point, point);
    scheduleRenderImageEditorV2();
    return;
  }

  state.editor.cropStart = point;
  state.editor.cropRect = {
    x: point.x,
    y: point.y,
    width: 0,
    height: 0,
  };
  syncEditorControlsV2();
  scheduleRenderImageEditorV2();
}

function handleEditorPointerMoveV2(event) {
  if (!state.editor.isPointerDown || !state.editor.workingCanvas) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  const point = getEditorCanvasPoint(event);
  if (!point) {
    return;
  }

  if (state.editor.tool === "draw" || state.editor.tool === "erase") {
    if (state.editor.lastPoint) {
      drawEditorStrokeV2(state.editor.lastPoint, point);
    }

    state.editor.lastPoint = point;
    state.editor.strokeDirty = true;
    scheduleRenderImageEditorV2();
    return;
  }

  if (!state.editor.cropStart) {
    return;
  }

  state.editor.cropRect = {
    x: state.editor.cropStart.x,
    y: state.editor.cropStart.y,
    width: point.x - state.editor.cropStart.x,
    height: point.y - state.editor.cropStart.y,
  };
  syncEditorControlsV2();
  scheduleRenderImageEditorV2();
}

function handleEditorPointerUpV2(event) {
  if (!state.editor.isPointerDown) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  if (elements.editorCanvas?.hasPointerCapture?.(event.pointerId)) {
    elements.editorCanvas.releasePointerCapture(event.pointerId);
  }

  state.editor.isPointerDown = false;
  state.editor.lastPoint = null;
  state.editor.cropStart = null;

  if ((state.editor.tool === "draw" || state.editor.tool === "erase") && state.editor.strokeDirty) {
    pushEditorHistorySnapshotV2();
    state.editor.strokeDirty = false;
  }

  if (state.editor.cropRect && state.editor.tool === "crop") {
    const normalizedRect = normalizeCropRect(state.editor.cropRect);
    if (normalizedRect.width < 8 || normalizedRect.height < 8) {
      state.editor.cropRect = null;
    }
  }

  syncEditorControlsV2();
  scheduleRenderImageEditorV2();
}

function drawEditorStrokeV2(from, to) {
  if (!state.editor.workingContext) {
    return;
  }

  state.editor.workingContext.save();
  state.editor.workingContext.globalCompositeOperation =
    state.editor.tool === "erase" ? "destination-out" : "source-over";
  state.editor.workingContext.strokeStyle = state.editor.tool === "erase" ? "#000000" : state.editor.color;
  state.editor.workingContext.lineWidth = state.editor.brushSize;
  state.editor.workingContext.lineCap = "round";
  state.editor.workingContext.lineJoin = "round";
  state.editor.workingContext.beginPath();
  state.editor.workingContext.moveTo(from.x, from.y);
  state.editor.workingContext.lineTo(to.x, to.y);
  state.editor.workingContext.stroke();
  state.editor.workingContext.restore();
}

function applyEditorCropV2() {
  if (!state.editor.workingCanvas || !state.editor.cropRect || state.editor.isSaving) {
    return;
  }

  const rect = normalizeCropRect(state.editor.cropRect);
  if (rect.width < 8 || rect.height < 8) {
    setStatus("裁切範圍太小。", true);
    return;
  }

  const nextCanvas = document.createElement("canvas");
  nextCanvas.width = rect.width;
  nextCanvas.height = rect.height;
  const nextContext = nextCanvas.getContext("2d");
  if (!nextContext) {
    setStatus("裁切失敗。", true);
    return;
  }

  nextContext.drawImage(
    state.editor.workingCanvas,
    rect.x,
    rect.y,
    rect.width,
    rect.height,
    0,
    0,
    rect.width,
    rect.height,
  );

  state.editor.cropRect = null;
  setEditorWorkingCanvasV2(nextCanvas, { pushHistory: true, context: nextContext });
  syncEditorControlsV2();
  scheduleRenderImageEditorV2();
  setStatus("已套用裁切。");
}

function undoImageEditorV2() {
  restoreEditorHistorySnapshotV2(state.editor.historyIndex - 1);
}

function redoImageEditorV2() {
  restoreEditorHistorySnapshotV2(state.editor.historyIndex + 1);
}

function rotateImageEditorV2(direction) {
  if (!state.editor.workingCanvas || state.editor.isSaving) {
    return;
  }

  const source = state.editor.workingCanvas;
  const nextCanvas = document.createElement("canvas");
  nextCanvas.width = source.height;
  nextCanvas.height = source.width;

  const nextContext = nextCanvas.getContext("2d");
  if (!nextContext) {
    return;
  }

  nextContext.save();
  if (direction > 0) {
    nextContext.translate(nextCanvas.width, 0);
    nextContext.rotate(Math.PI / 2);
  } else {
    nextContext.translate(0, nextCanvas.height);
    nextContext.rotate(-Math.PI / 2);
  }
  nextContext.drawImage(source, 0, 0);
  nextContext.restore();

  state.editor.cropRect = null;
  setEditorWorkingCanvasV2(nextCanvas, { pushHistory: true, context: nextContext });
  syncEditorControlsV2();
  scheduleRenderImageEditorV2();
}

function createScaledEditorCanvasV2(image) {
  const scale = Math.min(EDITOR_MAX_EDGE / image.naturalWidth, EDITOR_MAX_EDGE / image.naturalHeight, 1);
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    return null;
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, width, height);
  return canvas;
}

function cloneEditorCanvasV2(sourceCanvas) {
  const canvas = document.createElement("canvas");
  canvas.width = sourceCanvas.width;
  canvas.height = sourceCanvas.height;
  const context = canvas.getContext("2d");
  context?.drawImage(sourceCanvas, 0, 0);
  return canvas;
}

function setEditorWorkingCanvasV2(canvas, options = {}) {
  const context = options.context || canvas.getContext("2d");
  if (!context) {
    return;
  }

  state.editor.workingCanvas = canvas;
  state.editor.workingContext = context;

  if (options.pushHistory) {
    pushEditorHistorySnapshotV2();
  }
}

function pushEditorHistorySnapshotV2() {
  if (!state.editor.workingCanvas) {
    return;
  }

  const snapshot = cloneEditorCanvasV2(state.editor.workingCanvas);
  const nextHistory = state.editor.history.slice(0, state.editor.historyIndex + 1);
  nextHistory.push(snapshot);

  if (nextHistory.length > EDITOR_HISTORY_LIMIT) {
    nextHistory.shift();
  }

  state.editor.history = nextHistory;
  state.editor.historyIndex = nextHistory.length - 1;
}

function restoreEditorHistorySnapshotV2(index) {
  if (
    state.editor.isSaving ||
    index < 0 ||
    index >= state.editor.history.length ||
    !state.editor.history[index]
  ) {
    return;
  }

  const snapshot = cloneEditorCanvasV2(state.editor.history[index]);
  setEditorWorkingCanvasV2(snapshot);
  state.editor.historyIndex = index;
  state.editor.cropRect = null;
  syncEditorControlsV2();
  scheduleRenderImageEditorV2();
}

function getEditorHintTextV2() {
  if (state.editor.tool === "crop") {
    return "拖拉框選要保留的範圍，再按套用裁切。";
  }

  if (state.editor.tool === "erase") {
    return "拖曳即可擦除，支援上一步與下一步。";
  }

  return "拖曳即可畫線，顏色和粗細可以在右側調整。";
}

async function saveImageEditorV2() {
  if (!state.activePreview || !state.editor.workingCanvas || state.editor.isSaving) {
    return;
  }

  try {
    state.editor.isSaving = true;
    setEditorBusyV2(true);

    const mimeType = getEditorOutputType(state.activePreview.originalName);
    const editedBlob = await canvasToBlob(state.editor.workingCanvas, mimeType);
    const editedFile = new File([editedBlob], state.activePreview.originalName || "image.png", {
      type: editedBlob.type || mimeType,
    });

    const formData = new FormData();
    formData.set("imageId", state.activePreview.id);
    formData.set("file", editedFile);

    const response = await fetch("/api/images", {
      method: "PUT",
      body: formData,
    });

    const payload = await parseJson(response);
    if (!response.ok) {
      throw new Error(payload.error || "儲存圖片失敗。");
    }

    applyEditedImage(payload.image);
    closeImageEditorV2({ force: true });
    setStatus("圖片已更新。");
  } catch (error) {
    console.error(error);
    setStatus(error.message || "儲存圖片失敗。", true);
  } finally {
    state.editor.isSaving = false;
    setEditorBusyV2(false);
  }
}

function setEditorBusyV2(isBusy) {
  if (elements.editPreview) {
    elements.editPreview.disabled = isBusy;
  }

  if (elements.editorCropTool) {
    elements.editorCropTool.disabled = isBusy;
  }

  if (elements.editorDrawTool) {
    elements.editorDrawTool.disabled = isBusy;
  }

  if (elements.editorEraserTool) {
    elements.editorEraserTool.disabled = isBusy;
  }

  if (elements.applyCropTool) {
    elements.applyCropTool.disabled = isBusy || !state.editor.cropRect;
  }

  if (elements.editorUndo) {
    elements.editorUndo.disabled = isBusy || state.editor.historyIndex <= 0;
  }

  if (elements.editorRedo) {
    elements.editorRedo.disabled =
      isBusy || state.editor.historyIndex >= state.editor.history.length - 1;
  }

  if (elements.editorRotateLeft) {
    elements.editorRotateLeft.disabled = isBusy;
  }

  if (elements.editorRotateRight) {
    elements.editorRotateRight.disabled = isBusy;
  }

  if (elements.resetEditor) {
    elements.resetEditor.disabled = isBusy;
  }

  if (elements.editorColor) {
    elements.editorColor.disabled = isBusy;
  }

  if (elements.editorBrushSize) {
    elements.editorBrushSize.disabled = isBusy;
  }

  if (elements.closeEditor) {
    elements.closeEditor.disabled = isBusy;
  }

  if (elements.saveEditor) {
    elements.saveEditor.disabled = isBusy;
  }
}
