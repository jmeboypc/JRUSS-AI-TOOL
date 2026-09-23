const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const WIX_DIR = 'C:\\Users\\jrussell\\AppData\\Local\\electron-builder\\Cache\\wix\\wix-4.0.0.5512.2-wix-4.0.0.5512.2';
const APP_DIR = path.join(__dirname, 'release', 'JRUSS AI TOOL-win32-x64');
const OUT_WXS = path.join(__dirname, 'release', 'installer.wxs');
const OUT_WIXOBJ = path.join(__dirname, 'release', 'installer.wixobj');
const OUT_MSI = path.join(__dirname, 'release', 'JRUSS_AI_TOOL_Setup_v2.5.1.msi');

console.log('1. Generating WiX Installer XML configuration for JRUSS AI TOOL v2.5.1...');

let componentCount = 0;
const componentsList = [];

function generateWixElements(dirPath, indent = '            ') {
  const items = fs.readdirSync(dirPath);
  let xml = '';

  const files = [];
  const dirs = [];

  items.forEach(item => {
    const fullPath = path.join(dirPath, item);
    if (fs.statSync(fullPath).isDirectory()) {
      dirs.push(item);
    } else {
      files.push(item);
    }
  });

  files.forEach(file => {
    const compId = `Comp_${++componentCount}`;
    xml += `${indent}<Component Id="${compId}" Guid="*">\n`;

    const fullPath = path.join(dirPath, file);
    const relativePath = path.relative(__dirname, fullPath);
    const safeId = `File_${compId}_${file.replace(/[^a-zA-Z0-9]/g, '_')}`.substring(0, 70);

    xml += `${indent}  <File Id="${safeId}" Source="${relativePath}" KeyPath="yes" />\n`;

    // Add main exe shortcuts
    if (file === 'JRUSS AI TOOL.exe' || file === 'CurriculumCraft.exe') {
      // Desktop Shortcut
      xml += `${indent}  <Shortcut Id="DesktopShortcut" Directory="DesktopFolder" Name="JRUSS AI TOOL" WorkingDirectory="INSTALLFOLDER" Icon="AppIcon.ico" IconIndex="0" Advertise="yes" />\n`;
      // Start Menu Shortcut
      xml += `${indent}  <Shortcut Id="StartMenuShortcut" Directory="ProgramMenuFolder" Name="JRUSS AI TOOL" WorkingDirectory="INSTALLFOLDER" Icon="AppIcon.ico" IconIndex="0" Advertise="yes" />\n`;
    }

    xml += `${indent}</Component>\n`;
    componentsList.push(compId);
  });

  dirs.forEach(dirName => {
    const dirId = `Dir_${componentCount}_${dirName.replace(/[^a-zA-Z0-9]/g, '_')}`.substring(0, 50);
    xml += `${indent}<Directory Id="${dirId}" Name="${dirName}">\n`;
    xml += generateWixElements(path.join(dirPath, dirName), indent + '  ');
    xml += `${indent}</Directory>\n`;
  });

  return xml;
}

const wixBody = generateWixElements(APP_DIR);

const wxsContent = `<?xml version="1.0" encoding="UTF-8"?>
<Wix xmlns="http://wixtoolset.org/schemas/v4/wxs">
  <Product Id="*" Name="JRUSS AI TOOL" Language="1033" Version="2.5.1" Manufacturer="Jamie Russell" UpgradeCode="d9fbc957-c30f-48d5-b6d1-e6a6a2414777">
    <Package InstallerVersion="200" Compressed="yes" InstallScope="perMachine" Description="JRUSS AI TOOL Secondary School Lesson Planner &amp; Document Tailoring Suite v2.5.1" Comments="Author: Jamie Russell, Website: https://www.jruss.co.uk" Manufacturer="Jamie Russell" />
    <MajorUpgrade DowngradeErrorMessage="A newer version of [ProductName] is already installed." />
    <MediaTemplate EmbedCab="yes" />

    <Icon Id="AppIcon.ico" SourceFile="${path.join(__dirname, 'icon.ico').replace(/\\/g, '/')}" />
    <Property Id="ARPPRODUCTICON" Value="AppIcon.ico" />
    <Property Id="ARPCOMMENTS" Value="Author: Jamie Russell, Website: https://www.jruss.co.uk" />
    <Property Id="ARPCONTACT" Value="Jamie Russell" />
    <Property Id="ARPHELPLINK" Value="https://www.jruss.co.uk" />

    <Property Id="WIXUI_INSTALLDIR" Value="INSTALLFOLDER" />
    
    <!-- User Interface selection -->
    <UIRef Id="WixUI_InstallDir" />
    <WixVariable Id="WixUILicenseRtf" Value="license.rtf" />
    <WixVariable Id="WixUIDialogBmp" Value="installer_dialog.bmp" />
    <WixVariable Id="WixUIBannerBmp" Value="installer_banner.bmp" />

    <Directory Id="TARGETDIR" Name="SourceDir">
      <Directory Id="ProgramFilesFolder">
        <Directory Id="MANUFACTURERFOLDER" Name="Jamie Russell">
          <Directory Id="INSTALLFOLDER" Name="JRUSS AI TOOL">
${wixBody}
          </Directory>
        </Directory>
      </Directory>
      <Directory Id="DesktopFolder" Name="Desktop" />
      <Directory Id="ProgramMenuFolder" Name="Programs" />
    </Directory>

    <Feature Id="ProductFeature" Title="JRUSS AI TOOL Installation" Level="1">
${componentsList.map(id => `      <ComponentRef Id="${id}" />`).join('\n')}
    </Feature>
  </Product>
</Wix>
`;

fs.writeFileSync(OUT_WXS, wxsContent, 'utf8');
console.log('WiX XML generated in release/installer.wxs.');

console.log('2. Running WiX Compiler (candle.exe)...');
try {
  const candlePath = path.join(WIX_DIR, 'candle.exe');
  execSync(`"${candlePath}" -out "${OUT_WIXOBJ}" "${OUT_WXS}"`, { stdio: 'inherit' });
  console.log('WiX compilation successful.');
} catch (err) {
  console.error('WiX Compiler failed:', err.message);
  process.exit(1);
}

console.log('3. Running WiX Linker (light.exe) to build CurriculumCraft_Setup.msi...');
try {
  const lightPath = path.join(WIX_DIR, 'light.exe');
  execSync(`"${lightPath}" -out "${OUT_MSI}" "${OUT_WIXOBJ}" -ext WixUIExtension -sval -spdb`, { stdio: 'inherit' });
  console.log('MSI Installer built successfully!');
  console.log('Output location:', OUT_MSI);
} catch (err) {
  console.error('WiX Linker failed:', err.message);
  process.exit(1);
}
