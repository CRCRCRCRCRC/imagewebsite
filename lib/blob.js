import { del, get, list, put } from "@vercel/blob";
import sharp from "sharp";

const ROOT_PREFIX = "folders/";
const IMAGE_NAME_METADATA_PATH = "_meta/image-names.json";
const METADATA_ACCESS = "public";
const FOLDER_MARKER = ".keep";
const DEFAULT_FOLDER_NAME = "我的圖片";
const THUMB_FOLDER_NAME = ".thumbs";
const THUMBNAIL_HEIGHT = 440;
const THUMBNAIL_QUALITY = 72;

export async function ensureDefaultFolder() {
  const defaultFolderId = encodeFolderId(DEFAULT_FOLDER_NAME);
  const exists = await folderExists(defaultFolderId);

  if (!exists) {
    await createFolderMarker(defaultFolderId);
  }
}

export async function listLibrary() {
  await ensureDefaultFolder();

  const [folderResult, imageResult, imageNames] = await Promise.all([
    listAll({ mode: "folded", prefix: ROOT_PREFIX }),
    listAll({ prefix: ROOT_PREFIX }),
    loadImageNames(),
  ]);

  const thumbnailBlobByImageId = new Map(
    imageResult.blobs
      .filter((blob) => isThumbnailPath(blob.pathname))
      .map((blob) => [getImageToken(blob.pathname), blob]),
  );

  const images = imageResult.blobs
    .filter((blob) => isOriginalImagePath(blob.pathname))
    .map((blob) => {
      const folderId = getFolderIdFromPath(blob.pathname);
      const originalName = getOriginalFileName(blob.pathname);
      const thumbnailBlob = thumbnailBlobByImageId.get(getImageToken(blob.pathname));

      return {
        id: blob.pathname,
        folderId,
        folderName: decodeFolderId(folderId),
        name: imageNames[blob.pathname] || getDisplayImageName(originalName),
        originalName,
        size: blob.size,
        uploadedAt: blob.uploadedAt,
        url: withBlobVersion(blob.url, blob.uploadedAt),
        thumbnailUrl: withBlobVersion(thumbnailBlob?.url || blob.url, thumbnailBlob?.uploadedAt || blob.uploadedAt),
      };
    })
    .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());

  const imageCountByFolder = new Map();
  images.forEach((image) => {
    imageCountByFolder.set(image.folderId, (imageCountByFolder.get(image.folderId) || 0) + 1);
  });

  const folderIds = new Set(
    folderResult.folders.filter((prefix) => !isThumbnailPath(prefix)).map(getFolderIdFromPrefix),
  );
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

export async function renameImage(imageId, name) {
  const normalizedName = normalizeImageName(name);
  if (!normalizedName) {
    throw new Error("圖片名稱不能是空的。");
  }

  const targetImage = isOriginalImagePath(imageId)
    ? { originalName: getOriginalFileName(imageId) }
    : null;
  if (!targetImage) {
    throw new Error("找不到這張圖片。");
  }

  const imageNames = await loadImageNames();
  imageNames[imageId] = normalizedName;
  await saveImageNames(imageNames);

  return {
    id: imageId,
    name: normalizedName,
    originalName: targetImage.originalName,
  };
}

export async function replaceImage(imageId, file) {
  if (!(file instanceof File)) {
    throw new Error("缺少編輯後的圖片檔案。");
  }

  if (!file.type.startsWith("image/")) {
    throw new Error("只能儲存圖片檔。");
  }

  if (!isOriginalImagePath(imageId)) {
    throw new Error("找不到要更新的圖片。");
  }

  const folderId = getFolderIdFromPath(imageId);
  const originalName = getOriginalFileName(imageId);
  const imageToken = getImageToken(imageId);
  const fileBuffer = Buffer.from(await file.arrayBuffer());
  const blob = await put(imageId, file, {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: file.type || getContentTypeFromName(originalName),
  });

  let thumbnailBlob = blob;

  try {
    const thumbnailBuffer = await createThumbnailBuffer(fileBuffer);
    thumbnailBlob = await put(thumbnailPath(folderId, imageToken, originalName), thumbnailBuffer, {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "image/webp",
    });
  } catch (error) {
    console.error("Thumbnail generation failed.", error);
  }

  return {
    id: imageId,
    originalName,
    url: withBlobVersion(blob.url, blob.uploadedAt),
    thumbnailUrl: withBlobVersion(thumbnailBlob.url, thumbnailBlob.uploadedAt),
    uploadedAt: blob.uploadedAt,
    updatedAt: new Date(blob.uploadedAt).getTime(),
  };
}

export async function deleteImage(imageId) {
  if (!isOriginalImagePath(imageId)) {
    throw new Error("Invalid image ID.");
  }

  const folderId = getFolderIdFromPath(imageId);
  const imageToken = getImageToken(imageId);
  const originalName = getOriginalFileName(imageId);

  await deleteBlobIfExists(imageId);
  await deleteBlobIfExists(thumbnailPath(folderId, imageToken, originalName));

  const imageNames = await loadImageNames();
  if (imageId in imageNames) {
    delete imageNames[imageId];
    await saveImageNames(imageNames);
  }
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

  const fileBuffer = Buffer.from(await file.arrayBuffer());
  const safeFileName = sanitizeFileName(file.name);
  const imageToken = crypto.randomUUID();
  const pathname = `${folderPrefix(folderId)}${imageToken}__${encodeURIComponent(safeFileName)}`;
  const blob = await put(pathname, file, {
    access: "public",
    addRandomSuffix: false,
    contentType: file.type || "application/octet-stream",
  });

  let thumbnailUrl = blob.url;

  try {
    const thumbnailBuffer = await createThumbnailBuffer(fileBuffer);
    const thumbnailBlob = await put(thumbnailPath(folderId, imageToken, safeFileName), thumbnailBuffer, {
      access: "public",
      addRandomSuffix: false,
      contentType: "image/webp",
    });
    thumbnailUrl = thumbnailBlob.url;
  } catch (error) {
    console.error("Thumbnail generation failed.", error);
  }

  return {
    url: blob.url,
    pathname: blob.pathname,
    thumbnailUrl,
  };
}

function normalizeFolderName(name) {
  return name.trim().replace(/\s+/g, " ");
}

function normalizeImageName(name) {
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

function thumbnailPath(folderId, imageToken, fileName) {
  const baseName = fileName.replace(/\.[^.]+$/, "") || fileName;
  return `${folderPrefix(folderId)}${THUMB_FOLDER_NAME}/${imageToken}__${encodeURIComponent(baseName)}.webp`;
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

async function createThumbnailBuffer(fileBuffer) {
  return sharp(fileBuffer, { animated: true })
    .rotate()
    .resize({
      height: THUMBNAIL_HEIGHT,
      withoutEnlargement: true,
      fit: "inside",
    })
    .webp({
      quality: THUMBNAIL_QUALITY,
    })
    .toBuffer();
}

async function loadImageNames() {
  const result = await get(IMAGE_NAME_METADATA_PATH, {
    access: METADATA_ACCESS,
  });

  if (!result || result.statusCode !== 200) {
    return {};
  }

  try {
    const text = await new Response(result.stream).text();
    const parsed = JSON.parse(text);

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    return parsed;
  } catch (error) {
    console.error("Image name metadata parsing failed.", error);
    return {};
  }
}

async function saveImageNames(imageNames) {
  await put(IMAGE_NAME_METADATA_PATH, JSON.stringify(imageNames), {
    access: METADATA_ACCESS,
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json; charset=utf-8",
    cacheControlMaxAge: 60,
  });
}

async function deleteBlobIfExists(pathname) {
  try {
    await del(pathname);
  } catch (error) {
    if (error?.name === "BlobNotFoundError") {
      return;
    }

    throw error;
  }
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

function getDisplayImageName(fileName) {
  const extension = getFileExtension(fileName);
  const baseName = extension ? fileName.slice(0, -extension.length) : fileName;
  const normalizedName = normalizeImageName(baseName);

  if (!normalizedName || isGeneratedImageName(normalizedName)) {
    return "未命名圖片";
  }

  return normalizedName;
}

function getFileExtension(fileName) {
  const lastDotIndex = fileName.lastIndexOf(".");
  if (lastDotIndex <= 0) {
    return "";
  }

  return fileName.slice(lastDotIndex);
}

function getContentTypeFromName(fileName) {
  const extension = getFileExtension(fileName).toLowerCase();

  if (extension === ".jpg" || extension === ".jpeg") {
    return "image/jpeg";
  }

  if (extension === ".webp") {
    return "image/webp";
  }

  return "image/png";
}

function withBlobVersion(url, uploadedAt) {
  const version = new Date(uploadedAt).getTime();
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}v=${version}`;
}

function sanitizeFileName(fileName) {
  const trimmed = fileName.trim();
  const withoutSlashes = trimmed.replace(/[\\/]/g, "-");
  const withoutReserved = withoutSlashes.replace(/[?%*:|"<>\u0000-\u001F]/g, "-");
  return withoutReserved || "image";
}

function isGeneratedImageName(name) {
  return /^[0-9a-f]{24,}$/i.test(name) || /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(name);
}

function isThumbnailPath(pathname) {
  return pathname.includes(`/${THUMB_FOLDER_NAME}/`);
}

function isOriginalImagePath(pathname) {
  return !pathname.endsWith(`/${FOLDER_MARKER}`) && !isThumbnailPath(pathname);
}

function getImageToken(pathname) {
  const segment = pathname.split("/").pop() || "";
  const separatorIndex = segment.indexOf("__");

  if (separatorIndex === -1) {
    return segment;
  }

  return segment.slice(0, separatorIndex);
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
