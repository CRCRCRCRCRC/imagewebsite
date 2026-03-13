import { list, put } from "@vercel/blob";

const ROOT_PREFIX = "folders/";
const FOLDER_MARKER = ".keep";
const DEFAULT_FOLDER_NAME = "我的圖片";

export async function ensureDefaultFolder() {
  const defaultFolderId = encodeFolderId(DEFAULT_FOLDER_NAME);
  const exists = await folderExists(defaultFolderId);

  if (!exists) {
    await createFolderMarker(defaultFolderId);
  }
}

export async function listLibrary() {
  await ensureDefaultFolder();

  const [folderResult, imageResult] = await Promise.all([
    listAll({ mode: "folded", prefix: ROOT_PREFIX }),
    listAll({ prefix: ROOT_PREFIX }),
  ]);

  const images = imageResult.blobs
    .filter((blob) => !blob.pathname.endsWith(`/${FOLDER_MARKER}`))
    .map((blob) => {
      const folderId = getFolderIdFromPath(blob.pathname);

      return {
        id: blob.pathname,
        folderId,
        folderName: decodeFolderId(folderId),
        name: getOriginalFileName(blob.pathname),
        size: blob.size,
        uploadedAt: blob.uploadedAt,
        url: blob.url,
      };
    })
    .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());

  const imageCountByFolder = new Map();
  images.forEach((image) => {
    imageCountByFolder.set(image.folderId, (imageCountByFolder.get(image.folderId) || 0) + 1);
  });

  const folderIds = new Set(folderResult.folders.map(getFolderIdFromPrefix));
  images.forEach((image) => folderIds.add(image.folderId));

  const folders = Array.from(folderIds)
    .filter(Boolean)
    .map((folderId) => ({
      id: folderId,
      name: decodeFolderId(folderId),
      imageCount: imageCountByFolder.get(folderId) || 0,
    }))
    .sort(sortFolders);

  return {
    folders,
    images,
  };
}

export async function createFolder(name) {
  const normalizedName = normalizeFolderName(name);
  const library = await listLibrary();
  const duplicated = library.folders.some(
    (folder) => folder.name.toLocaleLowerCase() === normalizedName.toLocaleLowerCase(),
  );

  if (duplicated) {
    throw new Error("已經有同名資料夾了，換一個名稱。");
  }

  const folderId = encodeFolderId(normalizedName);
  await createFolderMarker(folderId);

  return {
    id: folderId,
    name: normalizedName,
    imageCount: 0,
  };
}

export async function uploadImage(file, folderId) {
  if (!(file instanceof File)) {
    throw new Error("上傳內容不是有效的圖片檔案。");
  }

  if (!file.type.startsWith("image/")) {
    throw new Error("只能上傳圖片檔案。");
  }

  if (!folderId) {
    throw new Error("請先選擇資料夾。");
  }

  if (!(await folderExists(folderId))) {
    throw new Error("資料夾不存在，請重新整理後再試一次。");
  }

  const safeFileName = sanitizeFileName(file.name);
  const pathname = `${folderPrefix(folderId)}${crypto.randomUUID()}__${encodeURIComponent(safeFileName)}`;
  const blob = await put(pathname, file, {
    access: "public",
    addRandomSuffix: false,
    contentType: file.type || "application/octet-stream",
  });

  return {
    url: blob.url,
    pathname: blob.pathname,
  };
}

function normalizeFolderName(name) {
  return name.trim().replace(/\s+/g, " ");
}

function encodeFolderId(name) {
  return encodeURIComponent(normalizeFolderName(name));
}

function decodeFolderId(folderId) {
  return decodeURIComponent(folderId);
}

function folderPrefix(folderId) {
  return `${ROOT_PREFIX}${folderId}/`;
}

function markerPath(folderId) {
  return `${folderPrefix(folderId)}${FOLDER_MARKER}`;
}

async function createFolderMarker(folderId) {
  await put(markerPath(folderId), "folder", {
    access: "public",
    addRandomSuffix: false,
    contentType: "text/plain; charset=utf-8",
  });
}

async function folderExists(folderId) {
  const result = await list({
    prefix: folderPrefix(folderId),
    limit: 1,
  });

  return result.blobs.length > 0;
}

async function listAll(options) {
  const folders = [];
  const blobs = [];
  let cursor;

  do {
    const result = await list({
      limit: 1000,
      ...options,
      cursor,
    });

    if (result.folders) {
      folders.push(...result.folders);
    }

    blobs.push(...result.blobs);
    cursor = result.hasMore ? result.cursor : undefined;
  } while (cursor);

  return {
    folders,
    blobs,
  };
}

function getFolderIdFromPrefix(prefix) {
  return prefix.slice(ROOT_PREFIX.length).replace(/\/$/, "");
}

function getFolderIdFromPath(pathname) {
  return pathname.slice(ROOT_PREFIX.length).split("/")[0];
}

function getOriginalFileName(pathname) {
  const segment = pathname.split("/").pop() || "";
  const separatorIndex = segment.indexOf("__");

  if (separatorIndex === -1) {
    return decodeURIComponent(segment);
  }

  return decodeURIComponent(segment.slice(separatorIndex + 2));
}

function sanitizeFileName(fileName) {
  const trimmed = fileName.trim();
  const withoutSlashes = trimmed.replace(/[\\/]/g, "-");
  const withoutReserved = withoutSlashes.replace(/[?%*:|"<>\u0000-\u001F]/g, "-");
  return withoutReserved || "image";
}

function sortFolders(a, b) {
  if (a.name === DEFAULT_FOLDER_NAME) {
    return -1;
  }

  if (b.name === DEFAULT_FOLDER_NAME) {
    return 1;
  }

  return a.name.localeCompare(b.name, "zh-Hant");
}
