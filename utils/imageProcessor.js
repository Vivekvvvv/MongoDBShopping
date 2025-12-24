const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

/**
 * 图片压缩配置
 */
const IMAGE_CONFIG = {
  maxWidth: 1200,
  maxHeight: 1200,
  quality: 80,
  thumbnailWidth: 300,
  thumbnailHeight: 300,
  formats: ['jpg', 'jpeg', 'png', 'webp', 'gif']
};

/**
 * 压缩图片
 * @param {string} inputPath - 输入文件路径
 * @param {string} outputPath - 输出文件路径
 * @param {Object} options - 压缩选项
 * @returns {Promise<Object>} 处理结果
 */
const compressImage = async (inputPath, outputPath, options = {}) => {
  try {
    const {
      maxWidth = IMAGE_CONFIG.maxWidth,
      maxHeight = IMAGE_CONFIG.maxHeight,
      quality = IMAGE_CONFIG.quality
    } = options;

    const image = sharp(inputPath);
    const metadata = await image.metadata();

    // 计算新尺寸
    let width = metadata.width;
    let height = metadata.height;

    if (width > maxWidth || height > maxHeight) {
      const ratio = Math.min(maxWidth / width, maxHeight / height);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
    }

    // 根据格式选择压缩方式
    let processedImage = image.resize(width, height, {
      fit: 'inside',
      withoutEnlargement: true
    });

    const ext = path.extname(outputPath).toLowerCase();

    if (ext === '.jpg' || ext === '.jpeg') {
      processedImage = processedImage.jpeg({ quality, mozjpeg: true });
    } else if (ext === '.png') {
      processedImage = processedImage.png({ compressionLevel: 8 });
    } else if (ext === '.webp') {
      processedImage = processedImage.webp({ quality });
    }

    await processedImage.toFile(outputPath);

    // 获取压缩后的文件大小
    const originalSize = fs.statSync(inputPath).size;
    const compressedSize = fs.statSync(outputPath).size;

    return {
      success: true,
      originalSize,
      compressedSize,
      compressionRatio: ((1 - compressedSize / originalSize) * 100).toFixed(2) + '%',
      dimensions: { width, height }
    };
  } catch (error) {
    console.error('图片压缩失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * 生成缩略图
 * @param {string} inputPath - 输入文件路径
 * @param {string} outputPath - 输出文件路径
 * @param {Object} options - 缩略图选项
 * @returns {Promise<Object>} 处理结果
 */
const generateThumbnail = async (inputPath, outputPath, options = {}) => {
  try {
    const {
      width = IMAGE_CONFIG.thumbnailWidth,
      height = IMAGE_CONFIG.thumbnailHeight
    } = options;

    await sharp(inputPath)
      .resize(width, height, {
        fit: 'cover',
        position: 'center'
      })
      .jpeg({ quality: 70 })
      .toFile(outputPath);

    return { success: true };
  } catch (error) {
    console.error('缩略图生成失败:', error);
    return { success: false, error: error.message };
  }
};

/**
 * 处理上传的图片（压缩 + 生成缩略图）
 * @param {string} filePath - 上传的文件路径
 * @param {string} uploadDir - 上传目录
 * @returns {Promise<Object>} 处理结果
 */
const processUploadedImage = async (filePath, uploadDir) => {
  try {
    const ext = path.extname(filePath);
    const basename = path.basename(filePath, ext);

    // 创建缩略图目录
    const thumbDir = path.join(uploadDir, 'thumbnails');
    if (!fs.existsSync(thumbDir)) {
      fs.mkdirSync(thumbDir, { recursive: true });
    }

    // 压缩原图
    const compressedPath = path.join(uploadDir, `${basename}_compressed${ext}`);
    const compressResult = await compressImage(filePath, compressedPath);

    // 如果压缩成功，替换原文件
    if (compressResult.success && compressResult.compressedSize < compressResult.originalSize) {
      fs.unlinkSync(filePath);
      fs.renameSync(compressedPath, filePath);
    } else if (fs.existsSync(compressedPath)) {
      fs.unlinkSync(compressedPath);
    }

    // 生成缩略图
    const thumbPath = path.join(thumbDir, `${basename}_thumb.jpg`);
    await generateThumbnail(filePath, thumbPath);

    return {
      success: true,
      originalPath: filePath,
      thumbnailPath: thumbPath,
      ...compressResult
    };
  } catch (error) {
    console.error('图片处理失败:', error);
    return { success: false, error: error.message };
  }
};

/**
 * 验证图片格式
 * @param {string} filename - 文件名
 * @returns {boolean} 是否是有效的图片格式
 */
const isValidImageFormat = (filename) => {
  const ext = path.extname(filename).toLowerCase().slice(1);
  return IMAGE_CONFIG.formats.includes(ext);
};

module.exports = {
  IMAGE_CONFIG,
  compressImage,
  generateThumbnail,
  processUploadedImage,
  isValidImageFormat
};
