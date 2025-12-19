# PeerTube Static Files & Admin Stats Plugin

A comprehensive plugin for PeerTube that offers both static file management and detailed admin statistics in a unified solution.

## 🚀 Key Features

### 📁 File management
- **Upload images and documents** with drag & drop interface
- **Flexible user rights** with granular control
- **Admin interface** for central file management
- **Automatic categorization** by file types
- **Link sharing** with one click

### 📊 Admin stats
- **Instance Metrics**: Users, Videos, Storage, Engagement
- **Video Analytics**: Detailed viewership numbers, watch time
- **Top Content**: Most viewed videos and most popular channels
- **Time-based evaluations** with flexible grouping
- **Responsive Dashboards** with dynamic charts
- **Real-time data update**

## 📋 Supported file types

### 🖼️ Pictures
- **JPG/JPEG** - Standard image format
- **PNG** - Lossless compression
- **GIF** - Animated images
- **WebP** - Modern compression
- **ICO** - Favicon and icons

### 📄 Documents
- **PDF** - Portable Document Format
- **TXT** - text files
- **DOC** - Microsoft Word (Legacy)
- **DOCX** - Microsoft Word (Modern)

## 🔧 Installation

### Automatic installation (recommended)
1. Open your **PeerTube admin interface**
2. Navigate to **"Plugins & Themes"**
3. Search for **"peertube-plugin-static-files"**
4. Click **"Install"**

### Manual installation
```bash
cd /var/www/peertube
sudo -u peertube npm install peertube-plugin-static-files
sudo systemctl restart peertube
```

### Development Installation
```bash
git clone https://github.com/yarkolife/peertube-plugin-static-files.git
cd peertube-plugin-static-files
npm install
npm run build
```

## ⚙️ Configuration

After installation, navigate to:
**Admin → Plugins & Themes → peertube-plugin-static-files → Settings**

### 🛠️ Available settings

| Setting | Description | Default | Options |
|-------------|--------------|----------|----------|
| **Activate plugin** | Master switch for the entire plugin | ✅ Enabled | ☑️ / ☐ |
| **Upload Page Path** | URL path for the upload page | `files/upload` | Any path |
| **Authorized Users** | Comma separated list of specific users | Empty (all) | `user1,user2,user3` |
| **Eligible Roles** | System roles with access | All registered | See below |
| **Allowed file types** | Upload Limits | All | Images/Documents/All |
| **Max. File size** | Upload limit in megabytes | 50MB | 1-100MB |

### 👥 Eligible roles

- **All logged in users** *(Default)*
  - Anyone with a valid account can upload files
  - Users only see their own files
  
- **Administrators only**
  - Maximum security
  - Full access to all functions
  
- **Administrators and Moderators**
  - Moderators receive upload rights
  - Admins retain all statistics functions

## 🎯 Usage

### 👤 For end users

1. **Access to the upload page**
   ```
   https://ihre-domain.de/p/files/upload
   ```

2. **File upload process**
   - Registration (if required)
   - Drag and drop or use file browser
   - Monitor upload progress
   - Copy and share links

3. **File Management**
   - View my files
   - Preview in new tab
   - Download function
   - Deletion (own files only)

### 🔧 For administrators

#### 📁 File management
**Access:** `/p/files/admin`

- **Show all files** with metadata
- **Bulk operations** for efficient management
- **Cleanup function** for orphaned files
- **User mapping** and upload timestamp

#### 📊 Statistics dashboard
**Access:** `/p/admin/stats`

- **Instance Metrics**
  - Total users & videos (+ monthly increase)
  - **NEW:** Used storage space
  - **NEW:** Engagement (Comments & Likes)
  - Open reports/complaints

- **Video Analytics**
  - **NEW:** Watch Time Analysis
  - **NEW:** Top Lists (Videos & Channels)
  - **NEW:** Interactive charts
  - Flexible period selection (day/month/year)

## 🔗 API endpoints

### 🌐 Public endpoints
```http
GET /plugins/static-files/router/file/:category/:filename
```
- Direct file delivery
- Caching headers for performance
- Content type detection

### 🔐 Authenticated endpoints

#### File management
```http
GET /plugins/static-files/router/check-access # Check access
POST /plugins/static-files/router/upload # Upload file  
GET /plugins/static-files/router/files # My files
DELETE /plugins/static-files/router/file/:category/:filename # Delete file
```

#### Admin features
```http
GET /plugins/static-files/router/admin/files # List all files
POST /plugins/static-files/router/admin/cleanup # Clean up orphaned files
GET /plugins/static-files/router/admin/stats # Instance statistics
```

### 📝 API examples

#### Upload with cURL
```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@example.jpg" \
  https://ihre-domain.de/plugins/static-files/router/upload
```

#### Get statistics
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "https://ihre-domain.de/plugins/static-files/router/admin/stats?from=2024-01-01&to=2024-12-31&groupBy=month"
```

## 🛠️ Development

### 📦 Requirements
- **Node.js** ≥ 16.0.0
- **PeerTube** ≥ 5.2.0
- **npm** or **yarn**

### 🏗️ Development setup
```bash
# Clone repository
git clone https://github.com/yarkolife/peertube-plugin-static-files.git
cd peertube-plugin-static-files

# Install dependencies
npm install

# Development Build
npm run build

# For live development
npm run dev
```

### 📁 Project structure
```
peertube-plugin-static-files/
├── assets/
│ └── style.css # UI styling
├── client/
│ ├── client-plugin.js # Main client code
│ └── stats-page.js # Statistics interface
├── routes/
│ └── stats.js # Statistics API routes
├── dist/ # Built files
├── public/uploads/ # Uploaded files
│ ├── images/ # Images category
│ └── documents/ # Document category
├── metadata/ # File metadata (JSON)
├── scripts/
│ └── build.js # Build pipeline
├── main.js # Server-side main code
├── package.json # Project configuration
└── README.md # This documentation
```

### 🔄 Build process
```bash
# Full build
npm run build

# Client files only
nodescripts/build.js

# Development with auto-reload  
npm run dev
```

## 🔒 Security & Best Practices

### 🛡️ Safety measures
- **Strict file type validation** on server and client side
- **File size limits** configurable up to 100MB
- **User authorization** on every API call
- **Path sanitization** prevents directory traversal
- **MIME type check** in addition to the file extension

### ⚡ Performance optimizations
- **Streaming File Upload** for large files
- **ETag & Cache-Control** headers for browser caching
- **Lazy loading** in the file list
- **Chunked Transfer** for downloads
- **Database Query Optimization** for statistics

### 📊 Monitoring & Logging
- **Detailed upload logs** with user tracking
- **Error Handling** with meaningful error messages
- **Performance metrics** for admin dashboard
- **Audit Trail** for admin actions

## 🐛 Troubleshooting

### ❗ Common problems

#### Plugin doesn't load
```bash
# Check PeerTube logs
journalctl -u peertube -f

# Check plugin status
sudo -u peertube npm list | grep static files

# Fix file permissions
sudo chown -R peertube:peertube /var/www/peertube/plugins/
```

#### Upload fails
- ✅ **Check file size** (default: 50MB)
- ✅ **Validate file type** (see supported formats)
- ✅ **Storage space available** in the uploads directory
- ✅ Increase **Nginx upload limit** if necessary

#### 403 Access denied
- ✅ **Check user login**
- ✅ Check **plugin settings**
- ✅ Validate **role configuration**

#### Statistics not loading
- ✅ Confirm **admin/moderator rights**
- ✅ Test **database access**
- ✅ Check **API endpoints** via browser/cURL

### 🔧 Enable debug mode
```javascript
// Add temporarily in main.js:
```
console.log('DEBUG: Plugin loaded with settings:', settings);
```

## 📈 Changelog

### v1.6.5 *(Current)*
- 🐛 **Fix:** NPM installation fixed (prepare script removed)

### v1.6.4
- 🐛 **Fix:** Correct parsing of categories from the API (object instead of array)

### v1.6.3
- ✅ **Improved:** Categories are loaded dynamically via PeerTube API
- 🔧 **Fix:** Compatible with peertube plugin categories

### v1.6.2
- ✅ **Improved:** Category names adjusted (short film, local documentary, etc.)

### v1.6.1
- 🐛 **Fix:** renderRegionsCard function was missing
- 🐛 **Fix:** Top channels and categories showed incorrect view numbers  
- 🐛 **Fix:** Video counts were inflated (now COUNT DISTINCT)
- ✅ **Improved:** Watch Time = actual playback time (not video length)
- ✅ **Improved:** Views = individual view events (not aggregated)

### v1.6.0
- 🏆 **New:** Top Channels Statistics (Views, Watch Time, Video Count)
- 🏷️ **New:** Top categories analysis
- 📈 **New:** Fast Growing Videos (7-Day Comparison)
- 📊 **New:** Channel Performance Dashboard
- 🚀 **New:** Growth tracking with percent growth

### v1.5.0
- 🔥 **New:** Activity Heatmap (Hour × Weekday)
- 💡 **New:** Best release times recommendations
- 📊 **New:** Watch Time Percentiles (p25, p50, p75, p90, p95)
- 📈 **New:** Retention Distribution Visualization
- 🎯 **New:** Interactive heatmap with hover effects

### v1.4.1
- 🗺️ **New:** Regional statistics (top regions with country and views)
- 📊 **Improved:** Detailed breakdown by subdivisionName + country
- 👥 **New:** Unique Viewers per Region

### v1.4.0
- ✨ **New:** DAU/WAU/MAU metrics (Daily/Weekly/Monthly Active Users)
- 📊 **New:** Retention Metrics (Average & Median Watch Time)
- 📈 **New:** Time Series for Watch Time and Active Viewers
- 🎨 **New:** Interactive chart selector (Views / Watch Time / Active Viewers)
- 🔧 **Improved:** Advanced time series analysis

### v1.3.1
- 🎨 **New:** Modern dashboard design with dark theme and full page width
- ✨ **Improved:** Color-coded metrics cards (Blue, Green, Cyan, Orange, Purple, Pink)
- 🔧 **Improved:** Responsive grid layout and improved readability
- 💅 **New:** Animated hover effects and modern typography

### v1.3.0
- ✨ **New:** Detailed viewership statistics (unique viewers, countries, devices, operating systems, browsers)
- 🔧 **Improved:** Extended use of `localVideoViewer` table for precise data

### v1.2.9
- ✨ **New:** Exact playback time calculation (based on `localVideoViewer`)
- 🔧 **Improved:** Fallback to estimate if detailed data is not available
- 🗑️ **Removed:** Debug route

### v1.2.8
- 🔧 **Debug:** Added temporary route to schema analysis (for exact watch time)
- ✨ **New:** Support for SVG files when uploading
- 🔧 **Improved:** Video titles in stats are now fully readable and linked

### v1.2.7
- ✨ **New:** Support for SVG files when uploading
- 🔧 **Improved:** Video titles in stats are now fully readable and linked

### v1.2.6
- 🔧 **Improved:** Video titles in stats are now fully readable and linked
- ℹ️ **Info:** Clarification on Calculating Playback Time (Estimate)

### v1.2.5
- 🐛 **Fixed:** Missing statistics features in the frontend (build process corrected)
- 🔧 **Improved:** Integration of the statistics page

### v1.2.4
- 🐛 **Fixed:** HTTP 500 error on statistics page (error handling improved)
- 🔧 **Improved:** More robust playback time calculation

### v1.2.3
- ✨ **NEW:** Advanced stats (disk space, engagement, watch time)
- ✨ **NEW:** Top lists for videos and channels
- ✨ **NEW:** Dynamic charts for views history
- 🐛 **Fixed:** Path problems when uploading files (persistent storage)
- 🔧 **Improved:** Performance of database queries

### v1.2.0
- ✨ **NEW:** Basic admin stats
- ✨ **NEW:** Video analytics with flexible grouping  
- ✨ **NEW:** ICO file support
- 🔧 **Improved:** Modular architecture with separate routes
- 🔧 **Improved:** Enhanced error handling
- 🐛 **Fixed:** ES Module export issues

### v1.1.4
- 🔧 **Improved:** File metadata system
- 🔧 **Improved:** Admin interface overhaul
- 🐛 **Fixed:** Upload error handling

### v1.1.0
- ✨ Drag & Drop upload interface
- ✨ Flexible user rights management
- 🔧 Responsive design

## 🤝 Contribute

We look forward to your contributions to the further development of the plugin!

### 🔄 Contribution Workflow
1. Create a **fork** of the repository
2. Create **feature branch** (`git checkout -b feature/amazing-feature`)
3. **Commit changes** (`git commit -m 'Add amazing feature'`)
4. **Branch push** (`git push origin feature/amazing-feature`)
5. Create **Pull Request**

### 🐛 Bug Reports
Please use the **GitHub Issues** with the following information:
- PeerTube version
- Plugin version  
- Detailed error description
- Reproduction steps
- Browser/OS information

### 💡 Feature Requests
Describe new feature requests with:
- Use case and motivation
- Expected behavior
- Possible implementation approaches

## 📄 License

This plugin is released under the **AGPL-3.0** license.

```
PeerTube Static Files & Admin Stats Plugin
Copyright (C) 2025 yarkolife

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published
by the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.
```

Full license details can be found in the [LICENSE](LICENSE) file.

## 🙋‍♂️ Support & Community

### 📞 Support Channels
- **GitHub Issues**: [Bug Reports & Feature Requests](https://github.com/yarkolife/peertube-plugin-static-files/issues)
- **GitHub Discussions**: [Community Forum](https://github.com/yarkolife/peertube-plugin-static-files/discussions)
- **PeerTube Forum**: [Plugin specific discussions](https://framatalk.org/c/peertube)

### 🌟 Contributors
- **[yarkolife](https://github.com/yarkolife)** - Lead developer & maintainer
- **Community Contributors** - See [Contributors](https://github.com/yarkolife/peertube-plugin-static-files/graphs/contributors)

### 💖 Sponsorship
If this plugin is useful to you, you can support the development:
- ⭐ **GitHub Star** awarded
- 🍻 **Buy me a coffee** (link follows)
- 💼 Request **Enterprise Support**

---

**📌 Note**: This plugin is under active development. Regular updates bring new features and improvements. Feedback and suggestions for improvement are always welcome!

---

*Developed with ❤️ for the PeerTube Community*