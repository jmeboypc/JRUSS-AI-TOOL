# Installer Info Changing Guide (WiX & Electron MSI)

This guide explains how to customize all text, metadata, branding imagery, and shortcuts in the Windows **`.msi` installer**, as well as the commands required to compile and rebuild it.

---

## 1. File Map & Where Text is Located

The installer generation system relies on a few key files in the project root:

| File | Purpose | What You Can Change |
| :--- | :--- | :--- |
| [`build-msi.cjs`](file:///c:/Users/jrussell/Desktop/TeacherSummary/build-msi.cjs) | Generates the WiX XML script (`release/installer.wxs`) and drives the WiX compiler (`candle.exe` & `light.exe`). | App name, manufacturer, version, install paths, shortcuts, Add/Remove Programs metadata, and dialog banners. |
| [`license.rtf`](file:///c:/Users/jrussell/Desktop/TeacherSummary/license.rtf) | The EULA / Terms document rendered on the License Agreement dialog. | All legal disclaimer text, AI safety warnings, institution policy rules, and company terms. |
| [`installer_dialog.bmp`](file:///c:/Users/jrussell/Desktop/TeacherSummary/installer_dialog.bmp) | The 493×312 background graphic on the Welcome and Completion wizard screens. | The graphic artwork displayed on the left side of the installer dialog. |
| [`installer_banner.bmp`](file:///c:/Users/jrussell/Desktop/TeacherSummary/installer_banner.bmp) | The 493×58 top banner graphic on interior installer screens. | The header artwork shown at the top of the license and directory selection dialogs. |
| [`icon.ico`](file:///c:/Users/jrussell/Desktop/TeacherSummary/icon.ico) | The application icon file. | The icon applied to Desktop & Start Menu shortcuts and Add/Remove Programs. |
| [`pack.cjs`](file:///c:/Users/jrussell/Desktop/TeacherSummary/pack.cjs) | The master build orchestrator. | Calls Vite build, Electron packager, and WiX builder in sequence. |

---

## 2. Changing Product Information & Metadata

Open [`build-msi.cjs`](file:///c:/Users/jrussell/Desktop/TeacherSummary/build-msi.cjs). The text and configuration start around **line 66**:

### A. Product Name, Version & Manufacturer
```javascript
const wxsContent = `<?xml version="1.0" encoding="UTF-8"?>
<Wix xmlns="http://wixtoolset.org/schemas/v4/wxs">
  <Product Id="*" Name="JRUSS AI TOOL" Language="1033" Version="2.0.0" Manufacturer="Jamie Russell" UpgradeCode="d9fbc957-c30f-48d5-b6d1-e6a6a2414777">
    <Package InstallerVersion="200" Compressed="yes" InstallScope="perMachine" 
             Description="JRUSS AI TOOL Secondary School Lesson Planner &amp; Document Tailoring Suite v2.0" 
             Comments="Author: Jamie Russell, Website: https://www.jruss.co.uk" 
             Manufacturer="Jamie Russell" />
```
- **`Name`**: The display name shown in the installer wizard and Windows Settings.
- **`Version`**: Format `X.Y.Z` (e.g., `2.0.0`). When releasing an update, increase this so Windows Installer performs an upgrade rather than blocking installation.
- **`Manufacturer`**: Your name, organization, or school trust.
- **`Description`**: Summary shown in file properties and Windows Add/Remove Programs.

### B. Add/Remove Programs (Control Panel) Properties
Around line 73:
```javascript
    <Property Id="ARPCOMMENTS" Value="Author: Jamie Russell, Website: https://www.jruss.co.uk" />
    <Property Id="ARPCONTACT" Value="Jamie Russell" />
    <Property Id="ARPHELPLINK" Value="https://www.jruss.co.uk" />
```
- **`ARPCOMMENTS`**: Notes visible in Windows installed apps details.
- **`ARPCONTACT`**: Support contact name or email.
- **`ARPHELPLINK`**: Support or project URL.

### C. Installation Folder on User's PC
Around line 87:
```javascript
    <Directory Id="TARGETDIR" Name="SourceDir">
      <Directory Id="ProgramFilesFolder">
        <Directory Id="MANUFACTURERFOLDER" Name="Jamie Russell">
          <Directory Id="INSTALLFOLDER" Name="JRUSS AI TOOL">
```
- This determines where the application installs:  
  `C:\Program Files\Jamie Russell\JRUSS AI TOOL\`  
- You can change `Jamie Russell` or `JRUSS AI TOOL` to match your preferred folder hierarchy.

### D. Desktop & Start Menu Shortcut Names
Around line 42:
```javascript
    if (file === 'JRUSS AI TOOL.exe' || file === 'CurriculumCraft.exe') {
      // Desktop Shortcut
      xml += `${indent}  <Shortcut Id="DesktopShortcut" Directory="DesktopFolder" Name="JRUSS AI TOOL" WorkingDirectory="INSTALLFOLDER" Icon="AppIcon.ico" IconIndex="0" Advertise="yes" />\n`;
      // Start Menu Shortcut
      xml += `${indent}  <Shortcut Id="StartMenuShortcut" Directory="ProgramMenuFolder" Name="JRUSS AI TOOL" WorkingDirectory="INSTALLFOLDER" Icon="AppIcon.ico" IconIndex="0" Advertise="yes" />\n`;
    }
```
- Change `Name="JRUSS AI TOOL"` to change what the shortcut appears as on the teacher's Desktop or Start Menu.

---

## 3. Changing the License Agreement (EULA)

The license dialog displays [`license.rtf`](file:///c:/Users/jrussell/Desktop/TeacherSummary/license.rtf).

### How to edit:
1. Open [`license.rtf`](file:///c:/Users/jrussell/Desktop/TeacherSummary/license.rtf) directly in **WordPad**, **Microsoft Word**, or VS Code.
2. If using Microsoft Word or WordPad:
   - Edit the text, headings, and bullet points.
   - Save the file as **Rich Text Format (.rtf)**.
3. If using VS Code:
   - Make sure to maintain valid RTF syntax (e.g., `\par` for new lines, `\b` for bold, `\b0` to turn bold off).

---

## 4. Changing Installer Artwork

The installer uses standard WiX bitmap dimensions:

- **`installer_dialog.bmp`**:
  - Dimensions: **493 × 312 pixels**
  - Format: 24-bit BMP
  - Displayed on the **Welcome** and **Completion** dialog screens.
- **`installer_banner.bmp`**:
  - Dimensions: **493 × 58 pixels**
  - Format: 24-bit BMP
  - Displayed along the top of all intermediate wizard pages (License, Destination folder, Ready to install).
- **`icon.ico`**:
  - Multi-size ICO file (256x256, 48x48, 32x32, 16x16).
  - Used for shortcut icons and installer window icon.

If replacing BMP files, ensure they are saved strictly as uncompressed Windows Bitmap (`.bmp`) files with the exact dimensions listed above.

---

## 5. Step-by-Step Compilation Guide

Once your changes are saved, you can rebuild using the methods below.

### Method A: Full Automated Rebuild (Recommended)
This runs the Vite production build, packages the Electron `.exe`, and compiles the `.msi`:

Open PowerShell in `c:\Users\jrussell\Desktop\TeacherSummary`:
```powershell
node pack.cjs
```
*(Or run `npm run pack`)*

### What the script executes under the hood:
1. **`npm run build`**: Compiles the React application into `dist/`.
2. **`electron-packager`**: Bundles the desktop executable into `release/JRUSS AI TOOL-win32-x64/`.
3. **`node build-msi.cjs`**:
   - Generates `release/installer.wxs` scanning all packaged files.
   - Runs `candle.exe` (WiX compiler) to produce `release/installer.wixobj`.
   - Runs `light.exe` (WiX linker) to generate the final `release/JRUSS_AI_TOOL_Setup_v2.1.msi`.

---

### Method B: Fast MSI Recompile (If you only modified `build-msi.cjs` or `license.rtf`)
If you did **not** change any React UI source code or update electron dependencies, you can compile the `.msi` in seconds without re-bundling Electron:

```powershell
node build-msi.cjs
```

---

## 6. Output Files Checklist

After running the compilation, verify the output files in the `release/` directory:

| Path | Description |
| :--- | :--- |
| `release/JRUSS_AI_TOOL_Setup_v2.5.msi` | The final standalone Windows installer setup file. |
| `release/JRUSS AI TOOL-win32-x64/` | The unpacked portable application folder. |
| `release/JRUSS AI TOOL-win32-x64/JRUSS AI TOOL.exe` | The main executable binary. |
| `release/installer.wxs` | The generated WiX XML source file. |

---

## 7. App Updates & GitHub Release Hosting

`JRUSS AI TOOL` includes an integrated **In-App Update Checker** accessible via the **Updates** button in the header.

### How Updates Work:
1. **GitHub Release Check**:
   - The app makes a read-only request to `https://api.github.com/repos/<owner>/<repo>/releases/latest`.
   - It compares the tag (e.g. `v2.5.0` or `2.5.0`) against the app's internal version.
   - If a higher version is published, the app highlights the update in glowing emerald green, displays your release notes, and provides a direct download link.
2. **Seamless MSI Upgrades**:
   - Because `build-msi.cjs` configures `<MajorUpgrade DowngradeErrorMessage="..." />`, running any newer MSI installer will **automatically upgrade** the existing installation.
   - User settings and API keys stored in `localStorage` remain untouched across upgrades!

### How to Publish an Update:
1. Bump version numbers in `package.json`, `App.jsx`, `pack.cjs`, and `build-msi.cjs`.
2. Run `node pack.cjs` to produce `release/JRUSS_AI_TOOL_Setup_vX.X.msi`.
3. In your GitHub repository:
   - Go to **Releases** -> **Draft a new release**.
   - Set tag to e.g. `v2.6.0`.
   - Title: `JRUSS AI TOOL v2.6`.
   - Attach `JRUSS_AI_TOOL_Setup_v2.6.msi` as a release asset.
   - Click **Publish release**.
4. Any user running the app will see the update notification when clicking **Updates** in the header.

---

## 8. Troubleshooting Common WiX Errors

1. **"The system cannot find the path specified" (WiX Tools)**:
   - Check line 5 of `build-msi.cjs`:
     ```javascript
     const WIX_DIR = 'C:\\Users\\jrussell\\AppData\\Local\\electron-builder\\Cache\\wix\\wix-4.0.0.5512.2-wix-4.0.0.5512.2';
     ```
   - Ensure `candle.exe` and `light.exe` exist in this directory.
2. **"File in use" during rebuild**:
   - If `JRUSS AI TOOL` or the setup installer is currently running on your PC, close the application or kill it in Task Manager before compiling.
3. **Upgrades / Reinstallation**:
   - If testing repeated builds on the same machine, uninstall the previous version from Windows *Installed Apps* or bump the `Version="2.5.0"` in `build-msi.cjs`.
