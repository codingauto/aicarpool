const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// SVG文件路径
const svgPath = path.join(__dirname, '../public/favicon.svg');
const icoPath = path.join(__dirname, '../public/favicon.ico');

// 读取SVG文件
const svgBuffer = fs.readFileSync(svgPath);

// 生成不同尺寸的PNG
const sizes = [16, 32, 48];

async function createICO() {
  try {
    // 创建不同尺寸的PNG buffer
    const pngBuffers = await Promise.all(
      sizes.map(size => 
        sharp(svgBuffer)
          .resize(size, size)
          .png()
          .toBuffer()
      )
    );

    // ICO文件头
    const icoHeader = Buffer.alloc(6);
    icoHeader.writeUInt16LE(0, 0); // 保留字段
    icoHeader.writeUInt16LE(1, 2); // 类型: 1 = ICO
    icoHeader.writeUInt16LE(sizes.length, 4); // 图像数量

    // 图像目录项
    const dirEntries = [];
    let dataOffset = 6 + (16 * sizes.length); // 头部 + 目录项的偏移

    for (let i = 0; i < sizes.length; i++) {
      const entry = Buffer.alloc(16);
      entry.writeUInt8(sizes[i], 0); // 宽度
      entry.writeUInt8(sizes[i], 1); // 高度
      entry.writeUInt8(0, 2); // 调色板颜色数
      entry.writeUInt8(0, 3); // 保留
      entry.writeUInt16LE(1, 4); // 颜色平面数
      entry.writeUInt16LE(32, 6); // 每像素位数
      entry.writeUInt32LE(pngBuffers[i].length, 8); // 图像数据大小
      entry.writeUInt32LE(dataOffset, 12); // 图像数据偏移
      
      dirEntries.push(entry);
      dataOffset += pngBuffers[i].length;
    }

    // 组合ICO文件
    const icoBuffer = Buffer.concat([
      icoHeader,
      ...dirEntries,
      ...pngBuffers
    ]);

    // 写入ICO文件
    fs.writeFileSync(icoPath, icoBuffer);
    console.log('✅ favicon.ico 已成功生成!');
    console.log(`📍 文件位置: ${icoPath}`);
    console.log(`📐 包含尺寸: ${sizes.join('x, ')}x 像素`);
  } catch (error) {
    console.error('❌ 生成ICO文件时出错:', error);
    process.exit(1);
  }
}

// 检查sharp是否已安装
try {
  require.resolve('sharp');
  createICO();
} catch (e) {
  console.log('⚠️ sharp库未安装，正在安装...');
  const { execSync } = require('child_process');
  execSync('npm install sharp', { stdio: 'inherit' });
  console.log('✅ sharp库安装完成');
  createICO();
}