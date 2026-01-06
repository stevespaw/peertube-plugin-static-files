async function register({ registerClientRoute, registerHook, peertubeHelpers }) {
  console.log('Static Files Plugin: client registering...')

  const { notifier } = peertubeHelpers

  // INTEGRATION INTO THE LEFT MENU VIA A PEERTUBE HOOK
  registerHook({
    target: 'filter:left-menu.links.create.result',
    handler: async (defaultLinks) => {
      console.log('Static Files: Processing menu links via hook...')

      try {
        // Checking authorization
        if (!peertubeHelpers.isLoggedIn()) {
          console.log('Static Files: User not logged in, returning default links')
          return defaultLinks
        }

        // Checking access to the plugin.
        const accessData = await checkStaticFilesAccess()
        if (!accessData.hasAccess) {
          console.log('Static Files: No access to plugin, returning default links')
          return defaultLinks
        }

        console.log('Static Files: Adding menu section for user:', accessData.user.username)

        // Creating a section Static Files
        const staticFilesSection = {
          key: 'static-files',
          title: 'Static Files',
          links: []
        }

        // We are adding a link to download the files (for everyone with access).
        if (accessData.hasAccess) {
          staticFilesSection.links.push({
            icon: 'upload',
            label: 'Data-Upload',
            path: `/p/${accessData.uploadPath}`,
            isPrimaryButton: false
          })
        }

        // Adding links for administrators.
        if (accessData.isAdmin) {
          staticFilesSection.links.push({
            icon: 'cog', // We use 'cog' for the admin panel.
            label: 'File management',
            path: '/p/files/admin',
            isPrimaryButton: false
          })

          staticFilesSection.links.push({
            icon: 'stats',
            label: 'Admin Statistics',
            path: '/p/admin/stats',
            isPrimaryButton: false
          })
        }

        // We are adding our section to the existing links.
        const updatedLinks = [
          ...defaultLinks,
          staticFilesSection
        ]

        console.log('Static Files: Menu section added successfully:', staticFilesSection)
        return updatedLinks

      } catch (error) {
        console.error('Static Files: Error in menu hook:', error)
        return defaultLinks
      }
    }
  })

  // ACCESS CHECK FUNCTION (simplified for the hook)
  async function checkStaticFilesAccess() {
    try {
      const authHeader = peertubeHelpers.getAuthHeader()
      const response = await fetch('/plugins/static-files/router/check-access', {
        headers: authHeader || {}
      })

      if (response.ok) {
        const accessData = await response.json()
        const settings = await peertubeHelpers.getSettings()

        return {
          hasAccess: accessData.allowed,
          isAdmin: accessData.user && (accessData.user.role === 0 || accessData.user.role === 1),
          user: accessData.user,
          uploadPath: settings['page-path'] || 'files/upload'
        }
      }
    } catch (error) {
      console.error('Static Files: Access check failed:', error)
    }

    return { hasAccess: false, isAdmin: false }
  }

  // Global utilities for working with files
  window.StaticFilesPlugin = {

    // Downloading the file
    async uploadFile(file) {
      const formData = new FormData()
      formData.append('file', file)

      try {
        const authHeader = peertubeHelpers.getAuthHeader()
        const response = await fetch('/plugins/static-files/router/upload', {
          method: 'POST',
          body: formData,
          headers: authHeader || {}
        })

        const result = await response.json()

        if (result.success) {
          notifier.success('File uploaded successfully')
          return result.file
        } else {
          throw new Error(result.error || 'Unknown error')
        }
      } catch (error) {
        notifier.error('Error during upload: ' + error.message)
        throw error
      }
    },

    // Retrieve all files
    async getFiles() {
      try {
        const authHeader = peertubeHelpers.getAuthHeader()
        const response = await fetch('/plugins/static-files/router/files', {
          headers: authHeader || {}
        })

        const result = await response.json()
        return result.files || []
      } catch (error) {
        notifier.error('Error loading the files: ' + error.message)
        return []
      }
    },

    // Datei löschen
    async deleteFile(category, filename) {
      try {
        const authHeader = peertubeHelpers.getAuthHeader()
        const response = await fetch(`/plugins/static-files/router/file/${category}/${filename}`, {
          method: 'DELETE',
          headers: authHeader || {}
        })

        const result = await response.json()

        if (result.success) {
          notifier.success('File successfully deleted')
          return true
        } else {
          throw new Error(result.error || 'Unknown error')
        }
      } catch (error) {
        notifier.error('Error during deletion: ' + error.message)
        throw error
      }
    },

    // Help functions
    formatFileSize(bytes) {
      if (bytes === 0) return '0 Bytes'
      const k = 1024
      const sizes = ['Bytes', 'KB', 'MB', 'GB']
      const i = Math.floor(Math.log(bytes) / Math.log(k))
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
    },

    formatDate(dateString) {
      const date = new Date(dateString)
      return date.toLocaleDateString('de-DE', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      })
    },

    async copyToClipboard(text) {
      try {
        await navigator.clipboard.writeText(text)
        notifier.success('Link copied to clipboard.')
      } catch (error) {
        // Fallback for older browsers
        const textArea = document.createElement('textarea')
        textArea.value = text
        document.body.appendChild(textArea)
        textArea.select()
        document.execCommand('copy')
        document.body.removeChild(textArea)
        notifier.success('Link copied to clipboard.')
      }
    },

    getFileIcon(filename) {
      const extension = filename.split('.').pop().toLowerCase()
      const iconMap = {
        'jpg': '🖼️',
        'jpeg': '🖼️',
        'png': '🖼️',
        'gif': '🖼️',
        'webp': '🖼️',
        'ico': '🖼️',
        'svg': '🎨',
        'pdf': '📄',
        'txt': '📝',
        'doc': '📝',
        'docx': '📝'
      }
      return iconMap[extension] || '📎'
    }
  }

  // We are retrieving the plugin settings.
  const settings = await peertubeHelpers.getSettings()
  const uploadPath = settings['page-path'] || 'files/upload'

  // 1. ROUTE REGISTRATION FOR REGULAR USERS - FILE UPLOAD
  registerClientRoute({
    route: uploadPath,
    onMount: async ({ rootEl }) => {
      console.log('Static Files: upload route mounted')

      // Checking authorization
      if (!peertubeHelpers.isLoggedIn()) {
        rootEl.innerHTML = `
          <div class="margin-content col-md-12 col-xl-8" style="padding-top: 30px;">
            <div style="text-align: center; padding: 40px; font-family: sans-serif;">
              <h2>🔒 Registration required</h2>
              <p>You must be logged in to use this page.</p>
              <a href="/login" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">
                Register
              </a>
            </div>
          </div>
        `
        return
      }

      // Checking API access.
      try {
        const authHeader = peertubeHelpers.getAuthHeader()
        const response = await fetch('/plugins/static-files/router/check-access', {
          headers: authHeader || {}
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        const accessData = await response.json()

        if (accessData.allowed) {
          createUploadInterface(rootEl, accessData)
        } else {
          showAccessDenied(rootEl)
        }
      } catch (error) {
        console.error('Fehler bei API-Aufruf:', error)
        rootEl.innerHTML = `
          <div class="margin-content col-md-12 col-xl-8" style="padding-top: 30px;">
            <div style="text-align: center; padding: 40px; font-family: sans-serif;">
              <h2>⚠️ Error</h2>
              <p>Error loading the page: ${error.message}</p>
              <button onclick="location.reload()" style="background: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer;">
                Reload page
              </button>
            </div>
          </div>
        `
      }

      // Setting the page title.
      try {
        const config = await peertubeHelpers.getServerConfig()
        document.title = `Date-Upload - ${config.instance.name}`
      } catch (e) {
        document.title = 'Date-Upload'
      }
    }
  })

  // 2. ROUTE REGISTRATION FOR ADMINISTRATORS - FILE MANAGEMENT
  registerClientRoute({
    route: 'files/admin',
    onMount: async ({ rootEl }) => {
      console.log('Static Files: admin route mounted')

      // Checking authorization
      if (!peertubeHelpers.isLoggedIn()) {
        rootEl.innerHTML = `
          <div class="margin-content col-md-12 col-xl-8" style="padding-top: 30px;">
            <div style="text-align: center; padding: 40px; font-family: sans-serif;">
              <h2>🔒 Registration required</h2>
              <p>You must be logged in to use this page.</p>
              <a href="/login" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">
                Register
              </a>
            </div>
          </div>
        `
        return
      }

      // Checking access to admin functions.
      try {
        const authHeader = peertubeHelpers.getAuthHeader()
        const response = await fetch('/plugins/static-files/router/check-access', {
          headers: authHeader || {}
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        const accessData = await response.json()

        if (accessData.allowed) {
          createAdminInterface(rootEl, accessData)
        } else {
          showAccessDenied(rootEl)
        }
      } catch (error) {
        console.error('Error during admin API call:', error)
        rootEl.innerHTML = `
          <div class="margin-content col-md-12 col-xl-8" style="padding-top: 30px;">
            <div style="text-align: center; padding: 40px; font-family: sans-serif;">
              <h2>⚠️ Error</h2>
              <p>Error loading the admin page: ${error.message}</p>
              <button onclick="location.reload()" style="background: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer;">
                Reload page
              </button>
            </div>
          </div>
        `
      }

      // Setting the page title.
      try {
        const config = await peertubeHelpers.getServerConfig()
        document.title = `File management - ${config.instance.name}`
      } catch (e) {
        document.title = 'File management'
      }
    }
  })

  // StatsPage class is now loaded from stats-page.js

  // 3. ROUTE REGISTRATION FOR ADMINISTRATIVE STATISTICS
  registerClientRoute({
    route: 'admin/stats',
    onMount: async ({ rootEl }) => {
      console.log('Static Files: admin stats route mounted')

      // Checking authorization
      if (!peertubeHelpers.isLoggedIn()) {
        rootEl.innerHTML = `
          <div class="margin-content col-md-12 col-xl-8" style="padding-top: 30px;">
            <div style="text-align: center; padding: 40px; font-family: sans-serif;">
              <h2>🔒 Registration required</h2>
              <p>You must be logged in to use this page.</p>
              <a href="/login" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">
                Register
              </a>
            </div>
          </div>
        `
        return
      }

      // Checking access to admin functions.
      try {
        const authHeader = peertubeHelpers.getAuthHeader()
        const response = await fetch('/plugins/static-files/router/check-access', {
          headers: authHeader || {}
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        const accessData = await response.json()

        if (accessData.allowed && (accessData.user.role === 0 || accessData.user.role === 1)) {
          // We create an instance of StatsPage and display the page.
          const statsPage = new StatsPage(peertubeHelpers)
          await statsPage.showPage({ rootEl })
        } else {
          showAccessDenied(rootEl)
        }
      } catch (error) {
        console.error('Error during stats API call:', error)
        rootEl.innerHTML = `
          <div class="margin-content col-md-12 col-xl-8" style="padding-top: 30px;">
            <div style="text-align: center; padding: 40px; font-family: sans-serif;">
              <h2>⚠️ Error</h2>
              <p>Error loading statistics: ${error.message}</p>
              <button onclick="location.reload()" style="background: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer;">
                Reload page
              </button>
            </div>
          </div>
        `
      }

      // Setting the page title.
      try {
        const config = await peertubeHelpers.getServerConfig()
        document.title = `Instance Statistics - ${config.instance.name}`
      } catch (e) {
        document.title = 'Instance Statistics'
      }
    }
  })

  function showAccessDenied(rootEl) {
    rootEl.innerHTML = `
      <div class="margin-content col-md-12 col-xl-8" style="padding-top: 30px;">
        <div style="text-align: center; padding: 40px; font-family: sans-serif;">
          <h2>🚫 Access denied</h2>
          <p>You do not have permission to access this page.</p>
          <p>Contact an administrator.</p>
        </div>
      </div>
    `
  }

  // FUNCTION FOR CREATING A DOWNLOAD INTERFACE (for regular users)
  function createUploadInterface(rootEl, accessData) {
    const { settings, user } = accessData

    rootEl.innerHTML = `
      <div class="container margin-content col-md-12 col-xl-10 pt-4">

        <div class="card mb-4">
          <div class="card-body text-center">
            <h1 class="card-title">📁 Data-Upload</h1>
            <p class="card-text">Welcome, <strong>${user.username}</strong>!</p>
          </div>
        </div>

        <div class="card mb-4">
          <div class="card-body">
            <h3 class="card-title">📤 Upload files</h3>

            <div id="drop-zone" class="upload-drop-zone mb-3">
              <div>
                <div class="display-4 text-primary mb-3">☁️</div>
                <h4 class="text-muted">Drag and drop files here.</h4>
                <p class="text-muted">or click to select</p>
                <p class="small text-muted">
                  <strong>Allowed types:</strong> ${getFileTypesText(settings.allowedFileTypes).replace('ICO', 'ICO, SVG')}<br>
                  <strong>Maximum size:</strong> ${settings.maxFileSize}MB
                </p>
              </div>
            </div>

            <input type="file" id="file-input" multiple class="form-control d-none" 
                  accept="${getAcceptTypes(settings.allowedFileTypes)}">

            <div id="upload-status" class="mt-3" style="display: none;"></div>
          </div>
        </div>

        <div class="card">
          <div class="card-body">
            <h3 class="card-title">📋 My files</h3>
            <div id="files-list">
              <div class="text-center text-muted p-4">
                <div class="display-4">⏳</div>
                <p>Files are being loaded...</p>
              </div>
            </div>
          </div>
        </div>

      </div>
    `

    initializeUpload(settings)
  }

  // ADMIN INTERFACE CREATION FUNCTION (for administrators)
  function createAdminInterface(rootEl, accessData) {
    const { user } = accessData

    rootEl.innerHTML = `
      <div class="container margin-content col-md-12 col-xl-10 pt-4">

        <!-- Заголовок -->
        <div class="card mb-4">
          <div class="card-body">
            <div class="d-flex justify-content-between align-items-center">
              <div>
                <h1 class="card-title mb-1">📁 File management (Admin)</h1>
                <p class="card-text text-muted">Welcome, <strong>${user.username}</strong> (${user.roleText})</p>
              </div>
              <div>
                <a href="/p/${uploadPath}" class="btn btn-outline-primary">
                  📤 For upload
                </a>
              </div>
            </div>
          </div>
        </div>

        <!-- Control buttons -->
        <div class="card mb-4">
          <div class="card-body">
            <h3 class="card-title">🛠️ Administration</h3>
            <div class="btn-group" role="group">
              <button id="admin-refresh-btn" class="btn btn-primary">
                🔄 Update files
              </button>
              <button id="admin-cleanup-btn" class="btn btn-warning">
                🧹 Clean up
              </button>
              <button id="admin-stats-btn" class="btn btn-info">
                📊 Statistics
              </button>
            </div>
          </div>
        </div>

        <!-- Stats (hidden by default) -->
        <div id="admin-stats" class="card mb-4" style="display: none;">
          <div class="card-body">
            <h3 class="card-title">📊 Statistics</h3>
            <div id="stats-content" class="row">
              <div class="col-12 text-center">
                <div class="spinner-border text-primary" role="status">
                  <span class="sr-only">Lädt...</span>
                </div>
                <p class="mt-2">Loading statistics...</p>
              </div>
            </div>
          </div>
        </div>

        <!-- List of files -->
        <div class="card">
          <div class="card-body">
            <h3 class="card-title">📋 All files</h3>
            <div id="admin-files-container">
              <div class="text-center p-4">
                <div class="spinner-border text-primary" role="status">
                  <span class="sr-only">Loading...</span>
                </div>
                <p class="mt-2">Loading files...</p>
              </div>
            </div>
          </div>
        </div>

      </div>
    `

    initializeAdminInterface()
  }

  // ADMIN INTERFACE INITIALIZATION
  function initializeAdminInterface() {
    // Button handlers
    document.getElementById('admin-refresh-btn')?.addEventListener('click', loadAdminFiles)
    document.getElementById('admin-cleanup-btn')?.addEventListener('click', handleAdminCleanup)
    document.getElementById('admin-stats-btn')?.addEventListener('click', toggleAdminStats)

    // We load the files during initialization.
    loadAdminFiles()
  }

  // FILE UPLOAD FOR ADMINISTRATOR
  async function loadAdminFiles() {
    const container = document.getElementById('admin-files-container')
    if (!container) return

    container.innerHTML = `
      <div class="text-center p-4">
        <div class="spinner-border text-primary" role="status">
          <span class="sr-only">Loading...</span>
        </div>
        <p class="mt-2">Loading files...</p>
      </div>
    `

    try {
      const authHeader = peertubeHelpers.getAuthHeader()
      const response = await fetch('/plugins/static-files/router/admin/files', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader
        },
        credentials: 'include'
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(`HTTP ${response.status}: ${errorData.error || response.statusText}`)
      }

      const data = await response.json()
      displayAdminFiles(data.files || [], data.stats || {})

    } catch (error) {
      console.error('Error loading the admin files:', error)
      container.innerHTML = `
        <div class="alert alert-danger">
          <h5>⚠️ Error loading the files.</h5>
          <p><strong>Details:</strong> ${error.message}</p>
          <button class="btn btn-outline-danger btn-sm" onclick="window.loadAdminFiles()">
            🔄 Try again
          </button>
        </div>
      `
    }
  }

  // DISPLAYING FILES FOR THE ADMINISTRATOR
  function displayAdminFiles(files, stats) {
    const container = document.getElementById('admin-files-container')
    if (!container) return

    if (files.length === 0) {
      container.innerHTML = `
        <div class="text-center p-5">
          <div style="font-size: 4rem;">📂</div>
          <h4 class="mt-3">No files available</h4>
          <p class="text-muted">No files have been uploaded yet.</p>
        </div>
      `
      updateAdminStats(stats)
      return
    }

    // Updating the statistics.
    updateAdminStats(stats)

    // We are sorting the files by upload date (newest first).
    files.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate))

    let html = `
      <div class="mb-3">
        <p class="text-muted">
          <strong>In Total:</strong> ${files.length} Dateien • 
          <strong>Size:</strong> ${formatFileSize(stats.totalSize || 0)} • 
          <strong>With metadata:</strong> ${stats.withMetadata || 0} • 
          <strong>Without metadata:</strong> ${stats.withoutMetadata || 0}
        </p>
      </div>
    `

    files.forEach(file => {
      const statusClass = file.hasMetadata ? 'status-with-metadata' : 'status-without-metadata'
      const statusText = file.hasMetadata ? 'With metadata' : 'Without metadata'
      const statusIcon = file.hasMetadata ? '✅' : '❌'

      html += `
        <div class="file-item">
          <div class="d-flex justify-content-between align-items-start">
            
            <div class="flex-grow-1">
              <div class="d-flex align-items-center mb-2">
                <span class="mr-2">${getFileIcon(file.filename)}</span>
                <strong>${file.filename}</strong>
                <span class="file-status ${statusClass}">
                  ${statusIcon} ${statusText}
                </span>
              </div>
              
              <div class="file-metadata">
                <div>📏 <strong>Size:</strong> ${formatFileSize(file.size)}</div>
                <div>📅 <strong>Uploaded:</strong> ${formatDate(file.uploadDate)}</div>
                <div>👤 <strong>From:</strong> ${file.uploadedBy}</div>
                <div>📂 <strong>Category:</strong> ${file.category}</div>
                <div>🗂️ <strong>MIME:</strong> ${file.mimetype}</div>
              </div>
            </div>

            <div class="file-actions">
              <button class="btn btn-outline-primary btn-sm" 
                      onclick="previewAdminFile('${file.url}')" title="Preview">
                👁️ View
              </button>
              <button class="btn btn-outline-secondary btn-sm" 
                      onclick="copyAdminFileLink('${file.url}')" title="Copy Link">
                📋 Copy link
              </button>
              <button class="btn btn-outline-info btn-sm" 
                      onclick="downloadAdminFile('${file.url}', '${file.filename}')" title="Download">
                💾 Download
              </button>
              <button class="btn btn-outline-danger btn-sm" 
                      onclick="deleteAdminFile('${file.category}', '${file.filename}')" title="Delete">
                🗑️ Delete
              </button>
            </div>
            
          </div>
        </div>
      `
    })

    container.innerHTML = html
  }

  // ОБНОВЛЕНИЕ СТАТИСТИКИ
  function updateAdminStats(stats) {
    const statsContent = document.getElementById('stats-content')
    if (!statsContent || !stats) return

    statsContent.innerHTML = `
      <div class="col-md-3 mb-3">
        <div class="card stats-card">
          <div class="card-body text-center">
            <div class="stats-number">${stats.total || 0}</div>
            <div>📁 In total</div>
          </div>
        </div>
      </div>
      <div class="col-md-3 mb-3">
        <div class="card bg-success text-white">
          <div class="card-body text-center">
            <div class="stats-number">${stats.withMetadata || 0}</div>
            <div>✅ With metadata</div>
          </div>
        </div>
      </div>
      <div class="col-md-3 mb-3">
        <div class="card bg-warning text-white">
          <div class="card-body text-center">
            <div class="stats-number">${stats.withoutMetadata || 0}</div>
            <div>❌ Without metadata</div>
          </div>
        </div>
      </div>
      <div class="col-md-3 mb-3">
        <div class="card bg-info text-white">
          <div class="card-body text-center">
            <div class="stats-number">${formatFileSize(stats.totalSize || 0)}</div>
            <div>💾 Size</div>
          </div>
        </div>
      </div>
    `
  }

  // FILE CLEANUP (ADMIN)
  async function handleAdminCleanup() {
    if (!confirm('FILE CLEANUP (ADMIN)\n\nThis will delete all files that are older than 30 days and do not have metadata.')) {
      return
    }

    try {
      const authHeader = peertubeHelpers.getAuthHeader()
      const response = await fetch('/plugins/static-files/router/admin/cleanup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader
        },
        credentials: 'include'
      })

      const result = await response.json()

      if (result.success) {
        showMessage(`✅ Successful: ${result.message}`, 'success')
        loadAdminFiles() // Updating the list
      } else {
        showMessage(`❌ Error: ${result.error || 'Cleanup failed'}`, 'error')
      }
    } catch (error) {
      showMessage(`❌ Error during cleanup: ${error.message}`, 'error')
    }
  }

  // STATISTICS SWITCHING
  function toggleAdminStats() {
    const statsDiv = document.getElementById('admin-stats')
    if (statsDiv) {
      const isVisible = statsDiv.style.display !== 'none'
      statsDiv.style.display = isVisible ? 'none' : 'block'

      const btn = document.getElementById('admin-stats-btn')
      if (btn) {
        btn.textContent = isVisible ? '📊 Statistics' : '📊 Hide statistics'
      }
    }
  }

  // GLOBAL FUNCTIONS FOR THE ADMIN INTERFACE
  window.loadAdminFiles = loadAdminFiles

  window.deleteAdminFile = async function (category, filename) {
    if (!confirm(`File "${filename}" Really delete?`)) {
      return
    }

    try {
      const authHeader = peertubeHelpers.getAuthHeader()
      const response = await fetch(`/plugins/static-files/router/file/${category}/${filename}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader
        },
        credentials: 'include'
      })

      const result = await response.json()

      if (result.success) {
        showMessage('✅ File successfully deleted', 'success')
        loadAdminFiles() // Updating the list.
      } else {
        showMessage(`❌ Error: ${result.error || 'Deletion failed'}`, 'error')
      }
    } catch (error) {
      showMessage(`❌ Error during deletion: ${error.message}`, 'error')
    }
  }

  window.previewAdminFile = function (url) {
    window.open(window.location.origin + url, '_blank')
  }

  window.copyAdminFileLink = async function (url) {
    const fullUrl = window.location.origin + url
    try {
      await navigator.clipboard.writeText(fullUrl)
      showMessage('✅ Link copied to clipboard!', 'success')
    } catch (error) {
      // Fallback for older browsers
      const textarea = document.createElement('textarea')
      textarea.value = fullUrl
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      showMessage('✅ Link copied to clipboard!', 'success')
    }
  }

  window.downloadAdminFile = function (url, filename) {
    const a = document.createElement('a')
    a.href = window.location.origin + url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  function getFileTypesText(allowedTypes) {
    switch (allowedTypes) {
      case 'images': return 'JPG, PNG, GIF, WebP, ICO (max. 50MB)'
      case 'documents': return 'PDF, TXT, DOC, DOCX (max. 50MB)'
      default: return 'JPG, PNG, GIF, WebP, ICO, PDF, TXT, DOC, DOCX (max. 50MB)'
    }
  }

  function getAcceptTypes(allowedTypes) {
    switch (allowedTypes) {
      case 'images': return '.jpg,.jpeg,.png,.gif,.webp,.ico'
      case 'documents': return '.pdf,.txt,.doc,.docx'
      default: return '.jpg,.jpeg,.png,.gif,.webp,.ico,.pdf,.txt,.doc,.docx'
    }
  }

  // FILE DOWNLOAD INITIALIZATION (for regular users)
  function initializeUpload(settings) {
    const dropZone = document.getElementById('drop-zone')
    const fileInput = document.getElementById('file-input')
    const uploadStatus = document.getElementById('upload-status')
    const filesList = document.getElementById('files-list')

    // Click to select files
    dropZone.onclick = () => fileInput.click()

    // File input change
    fileInput.onchange = (e) => {
      if (e.target.files.length > 0) {
        handleFiles(Array.from(e.target.files))
      }
    }

    // Drag & Drop
    dropZone.ondragover = (e) => {
      e.preventDefault()
      dropZone.style.borderColor = '#007bff'
      dropZone.style.background = '#f0f8ff'
    }

    dropZone.ondragleave = (e) => {
      e.preventDefault()
      dropZone.style.borderColor = '#ddd'
      dropZone.style.background = '#fafafa'
    }

    dropZone.ondrop = (e) => {
      e.preventDefault()
      dropZone.style.borderColor = '#ddd'
      dropZone.style.background = '#fafafa'

      const files = Array.from(e.dataTransfer.files)
      if (files.length > 0) {
        handleFiles(files)
      }
    }

    async function handleFiles(files) {
      uploadStatus.style.display = 'block'
      uploadStatus.innerHTML = `
        <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; border-left: 4px solid #2196f3;">
          <strong>Upload in progress...</strong>
          <div style="margin-top: 10px;">
            <div class="progress-container">
              <div id="progress-bar" class="progress-bar" style="width: 0%;"></div>
            </div>
            <div id="progress-text" style="margin-top: 5px; font-size: 0.9rem;">Preparation...</div>
          </div>
        </div>
      `

      const progressBar = document.getElementById('progress-bar')
      const progressText = document.getElementById('progress-text')
      let completed = 0

      for (const file of files) {
        try {
          progressText.textContent = `Load"${file.name}" high...`

          await uploadFile(file)
          completed++

          const progress = (completed / files.length) * 100
          progressBar.style.width = progress + '%'
          progressText.textContent = `${completed} from ${files.length} Files uploaded`

        } catch (error) {
          console.error('Upload error:', error)
          showMessage(`Errors in "${file.name}": ${error.message}`, 'error')
        }
      }

      setTimeout(() => {
        uploadStatus.style.display = 'none'
        loadFiles()
        showMessage(`${completed} File(s) uploaded successfully!`, 'success')
      }, 1000)

      fileInput.value = ''
    }

    async function uploadFile(file) {
      const formData = new FormData()
      formData.append('file', file)

      try {
        const response = await fetch('/plugins/static-files/router/upload', {
          method: 'POST',
          body: formData,
          headers: peertubeHelpers.getAuthHeader() || {}
        })

        // Check the status
        if (!response.ok) {
          let errorMessage = `HTTP ${response.status}: ${response.statusText}`

          // Correction: first, we clone the response for repeated reading.
          const responseClone = response.clone()

          try {
            const errorData = await response.json()
            if (errorData.error) {
              errorMessage = errorData.error

              // Special handling for file size errors
              if (errorData.errorCode === 'FILE_TOO_LARGE' || errorData.errorCode === 'FIELD_TOO_LARGE') {
                errorMessage = `File "${file.name}" is too large. Maximum: ${errorData.maxSize}MB`
              }
            }
          } catch (parseError) {
            // If parsing the JSON fails, we use the cloned response.
            try {
              const htmlResponse = await responseClone.text()
              if (response.status === 413 || htmlResponse.includes('413') || htmlResponse.includes('too large')) {
                errorMessage = `File "${file.name}" is too big (${Math.round(file.size / 1024 / 1024 * 10) / 10}MB). Maximum allowed: 100MB. The Nginx limit might also be too low.`
              }
            } catch (textError) {
              // Fallback
              if (response.status === 413) {
                errorMessage = `File "${file.name}" is too big (${Math.round(file.size / 1024 / 1024 * 10) / 10}MB). Server limit reached.`
              }
            }
          }

          throw new Error(errorMessage)
        }

        const result = await response.json()

        if (result.success) {
          return result.file
        } else {
          throw new Error(result.error || 'Upload failed')
        }
      } catch (error) {
        console.error('Upload error details:', error)
        throw error
      }
    }

    async function loadFiles() {
      try {
        const response = await fetch('/plugins/static-files/router/files', {
          headers: peertubeHelpers.getAuthHeader() || {}
        })

        const result = await response.json()
        const files = result.files || []

        if (files.length === 0) {
          filesList.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #666;">
              <div style="font-size: 3rem; margin-bottom: 15px;">📂</div>
              <h4>No files available</h4>
              <p>Upload your first file!</p>
            </div>
          `
          return
        }

        filesList.innerHTML = files.map(file => `
          <div class="card mb-3">
            <div class="card-body d-flex flex-wrap justify-content-between align-items-center">

              <div class="d-flex align-items-center gap-3 flex-grow-1">
                <div class="file-icon">${getFileIcon(file.filename)}</div>
                <div>
                  <div><strong>${file.filename}</strong></div>
                  <div class="text-muted small">
                    ${formatFileSize(file.size)} • ${formatDate(file.uploadDate)}${file.uploadedBy ? ` • from ${file.uploadedBy}` : ''}
                  </div>
                </div>
              </div>

              <div class="btn-group btn-group-sm" role="group">
                <button class="btn btn-outline-secondary" onclick="copyLink('${file.url}')" title="Copy link">📋</button>
                <button class="btn btn-outline-primary" onclick="openFile('${file.url}')" title="View">👁️</button>
                <button class="btn btn-outline-danger" onclick="deleteFile('${file.category}', '${file.filename}')" title="Delete">🗑️</button>
              </div>

            </div>
          </div>
        `).join('')

      } catch (error) {
        console.error('Load files error:', error)
        filesList.innerHTML = `
          <div class="error-message">
            <strong>Error loading the files.</strong><br>
            ${error.message}
          </div>
        `
      }
    }

    // Global functions for buttons
    window.copyLink = async function (url) {
      const fullUrl = window.location.origin + url
      try {
        await navigator.clipboard.writeText(fullUrl)
        showMessage('Link copied to clipboard!', 'success')
      } catch (error) {
        // Fallback
        const textarea = document.createElement('textarea')
        textarea.value = fullUrl
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
        showMessage('Link copied to clipboard!', 'success')
      }
    }

    window.openFile = function (url) {
      window.open(window.location.origin + url, '_blank')
    }

    window.deleteFile = async function (category, filename) {
      if (!confirm(`File "${filename}" Really delete?`)) return

      try {
        const response = await fetch(`/plugins/static-files/router/file/${category}/${filename}`, {
          method: 'DELETE',
          headers: peertubeHelpers.getAuthHeader() || {}
        })

        const result = await response.json()

        if (result.success) {
          showMessage('File successfully deleted', 'success')
          loadFiles()
        } else {
          throw new Error(result.error || 'Deletion failed')
        }
      } catch (error) {
        showMessage('Error during deletion: ' + error.message, 'error')
      }
    }

    // We load the files during initialization.
    loadFiles()
  }

  // UTILITIES
  function showMessage(text, type) {
    const div = document.createElement('div')
    div.className = `toast-notification ${type}`
    div.textContent = text
    document.body.appendChild(div)

    setTimeout(() => {
      if (div.parentNode) div.parentNode.removeChild(div)
    }, 4000)
  }

  function getFileIcon(filename) {
    const ext = filename.split('.').pop().toLowerCase()
    const icons = {
      'jpg': '🖼️',
      'jpeg': '🖼️',
      'png': '🖼️',
      'gif': '🖼️',
      'webp': '🖼️',
      'ico': '🖼️',
      'pdf': '📄',
      'txt': '📝',
      'doc': '📝',
      'docx': '📝'
    }
    return icons[ext] || '📎'
  }

  function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes'
    const k = 1024, sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('de-DE', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    })
  }

  console.log('Static Files Plugin: client registered successfully')
}

// IMPORTANT: Named export!
export {
  register
}

// === STATS PAGE INTEGRATION ===
class StatsPage {
  constructor(peertubeHelpers) {
    this.peertubeHelpers = peertubeHelpers;
  }

  async showPage({ rootEl }) {
    // Inject modern CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/plugins/static-files/public/stats-dashboard.css';
    document.head.appendChild(link);

    rootEl.innerHTML = `
      <div class="stats-dashboard">
        <div class="stats-dashboard-container">
          
          <!-- Header -->
          <div class="stats-header">
            <h1>📊 Instance Statistics</h1>
            <p>Detailed overview of your Media Platform</p>
          </div>

          <!-- Main Metrics -->
          <div id="main-metrics" class="metrics-grid">
            <div class="loading-container">
              <div class="loading-spinner"></div>
              <p>Added the statistics...</p>
            </div>
          </div>

          <!-- Video Statistics Section -->
          <div class="stats-section">
            <div class="stats-section-header">
              <h2 class="stats-section-title">📺 Video Statistics</h2>
            </div>
            
            <div class="stats-controls mb-3">
              <div class="control-group">
                <label class="control-label" for="stats-from">From:</label>
                <input type="date" id="stats-from" class="control-input" 
                       value="${new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}">
              </div>
              <div class="control-group">
                <label class="control-label" for="stats-to">Until:</label>
                <input type="date" id="stats-to" class="control-input" 
                       value="${new Date().toISOString().split('T')[0]}">
              </div>
              <div class="control-group">
                <label class="control-label" for="stats-group">Grouping:</label>
                <select id="stats-group" class="control-select">
                  <option value="day">Day</option>
                  <option value="month">Month</option>
                  <option value="year">Year</option>
                </select>
              </div>
              <div class="control-group">
                <label class="control-label" style="opacity: 0;">.</label>
                <button id="load-video-stats" class="control-button">
                  🔄 Load
                </button>
              </div>
            </div>

            <div id="video-stats">
              <p class="text-center" style="color: rgba(255,255,255,0.5); padding: 2rem;">
                Click "Load" to view video statistics.
              </p>
            </div>
          </div>

          <!-- Activity Heatmap Section -->
          <div class="stats-section">
            <div class="stats-section-header">
              <h2 class="stats-section-title">🔥 Activity Heatmap</h2>
            </div>
            
            <div id="activity-heatmap">
              <p class="text-center" style="color: rgba(255,255,255,0.5); padding: 2rem;">
                Loading video statistics...
              </p>
            </div>
          </div>

          <!-- Retention Distribution Section -->
          <div class="stats-section">
            <div class="stats-section-header">
              <h2 class="stats-section-title">📊 Watch Time Distribution</h2>
            </div>
            
            <div id="retention-distribution">
              <p class="text-center" style="color: rgba(255,255,255,0.5); padding: 2rem;">
                Loading video statistics...
              </p>
            </div>
          </div>

          <!-- Top Channels Section -->
          <div class="stats-section">
            <div class="stats-section-header">
              <h2 class="stats-section-title">🏆 Top Channels</h2>
            </div>
            
            <div id="top-channels">
              <p class="text-center" style="color: rgba(255,255,255,0.5); padding: 2rem;">
                Loading video statistics...
              </p>
            </div>
          </div>

          <!-- Categories & Growth Section -->
          <div class="stats-section">
            <div class="stats-section-header">
              <h2 class="stats-section-title">🚀 Categories & Growth</h2>
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 1.5rem;">
              <div>
                <h3 style="color: #fff; font-size: 1.1rem; margin-bottom: 1rem; font-weight: 600;">
                  🏷️ Top Categories
                </h3>
                <div id="top-categories"></div>
              </div>
              
              <div>
                <h3 style="color: #fff; font-size: 1.1rem; margin-bottom: 1rem; font-weight: 600;">
                  📈 Fast-growing videos
                </h3>
                <div id="fast-growing-videos"></div>
              </div>
            </div>
          </div>

        </div>
      </div>
    `;

    this.initializeStatsPage();
  }

  async initializeStatsPage() {
    await this.loadMainStats();

    document.getElementById('load-video-stats')?.addEventListener('click', () => {
      this.loadVideoStats();
    });
  }

  async loadMainStats() {
    const container = document.getElementById('main-metrics');
    if (!container) return;

    try {
      const authHeader = this.peertubeHelpers.getAuthHeader();
      const response = await fetch('/plugins/static-files/router/admin/stats', {
        headers: authHeader || {}
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();

      if (result.status === 'success') {
        this.displayMainStats(result.data, container);
      } else {
        throw new Error(result.message || 'Error loading');
      }
    } catch (error) {
      container.innerHTML = `
        <div style="grid-column: 1/-1; color: #ef4444; text-align: center; padding: 2rem;">
          <strong>Error:</strong> ${error.message}
        </div>
      `;
    }
  }

  displayMainStats(data, container) {
    const formatSize = (bytes) => {
      if (bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const watchTimeLabel = data.isEstimated ?
      'Estimated playback time' : 'Playback time';
    const watchTimeSubtitle = data.isEstimated ?
      'Based on views × video length' : 'Based on detailed protocols.';

    container.innerHTML = `
      <!-- Row 1: Main Stats -->
      <div class="metric-card blue">
        <div class="metric-label">👥 Total users</div>
        <div class="metric-value">${data.usersCount}</div>
        <div class="metric-subtitle">+${data.usersThisMonth} this month</div>
      </div>

      <div class="metric-card green">
        <div class="metric-label">🎥 Total videos</div>
        <div class="metric-value">${data.videosCount}</div>
        <div class="metric-subtitle">+${data.videosThisMonth} this month</div>
      </div>

      <div class="metric-card cyan">
        <div class="metric-label">💾 Storage used</div>
        <div class="metric-value">${formatSize(data.totalStorage || 0)}</div>
        <div class="metric-subtitle">Total storage usage</div>
      </div>

      <div class="metric-card orange">
        <div class="metric-label">💬 Comments / ❤️ Likes</div>
        <div class="metric-value">${data.totalComments || 0} / ${data.totalLikes || 0}</div>
        <div class="metric-subtitle">Community Engagement</div>
      </div>

      <!-- Row 2: Watch Time & Viewers -->
      <div class="metric-card purple">
        <div class="metric-label">⏱️ ${watchTimeLabel}</div>
        <div class="metric-value">${data.totalWatchTimeHours}<span class="metric-unit">Std.</span></div>
        <div class="metric-subtitle">${watchTimeSubtitle}</div>
      </div>

      <div class="metric-card pink">
        <div class="metric-label">👁️ Unique viewers</div>
        <div class="metric-value">${data.uniqueViewers || 0}</div>
        <div class="metric-subtitle">In the last 30 days</div>
      </div>

      <!-- Row 3: DAY/WEEK/MONTH -->
      <div class="metric-card blue" style="grid-column: span 2;">
        <div class="metric-label">📈 Active viewers</div>
        <div style="display: flex; gap: 2rem; align-items: flex-end; margin-top: 0.75rem;">
          <div>
            <div style="color: rgba(255,255,255,0.6); font-size: 0.75rem; margin-bottom: 0.25rem;">DAY</div>
            <div class="metric-value" style="font-size: 2rem;">${data.dau || 0}</div>
          </div>
          <div>
            <div style="color: rgba(255,255,255,0.6); font-size: 0.75rem; margin-bottom: 0.25rem;">WEEK</div>
            <div class="metric-value" style="font-size: 2rem;">${data.wau || 0}</div>
          </div>
          <div>
            <div style="color: rgba(255,255,255,0.6); font-size: 0.75rem; margin-bottom: 0.25rem;">MONTH</div>
            <div class="metric-value" style="font-size: 2rem;">${data.mau || 0}</div>
          </div>
        </div>
        <div class="metric-subtitle">Daily / Weekly / Monthly Active Users</div>
      </div>

      <div class="metric-card green">
        <div class="metric-label">⏱️ Retention metrics</div>
        <div style="margin-top: 0.75rem;">
          <div style="color: rgba(255,255,255,0.6); font-size: 0.75rem;">Ø Watch Time:</div>
          <div class="metric-value" style="font-size: 1.75rem;">${Math.round(data.avgWatchTimeSeconds || 0)}<span class="metric-unit">s</span></div>
          <div style="color: rgba(255,255,255,0.6); font-size: 0.75rem; margin-top: 0.5rem;">Median:</div>
          <div style="color: #fff; font-size: 1.25rem; font-weight: 600;">${Math.round(data.medianWatchTimeSeconds || 0)}s</div>
        </div>
      </div>
    `;

    // Add detailed stats sections below
    this.displayDetailedStats(data);
  }

  displayDetailedStats(data) {
    const container = document.getElementById('main-metrics');
    if (!container) return;

    // Devices, OS, Browsers, Countries, Regions
    const detailsHtml = `
      <div class="stats-section" style="grid-column: 1/-1; margin-top: 1rem;">
        <div class="data-grid">
          ${this.renderDataCard('📱 Devices', data.viewersByDevice, 'device', 'views')}
          ${this.renderDataCard('💻 Operating systems', data.viewersByOS, 'operatingSystem', 'views')}
          ${this.renderDataCard('🌐 Browser', data.viewersByClient, 'client', 'views')}
          ${this.renderDataCard('🌍 Countries', data.viewersByCountry?.slice(0, 5) || [], 'country', 'views')}
          ${this.renderRegionsCard(data.viewersByRegion || [])}
        </div>
      </div>

      <!-- Top Videos Tables -->
      <div class="stats-section" style="grid-column: 1/-1;">
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 1.5rem;">
          
          <div>
            <h3 style="color: #fff; font-size: 1.1rem; margin-bottom: 1rem; font-weight: 600;">🎥 Top videos (by time)</h3>
            <table class="stats-table">
              <thead>
                <tr>
                  <th>Video</th>
                  <th style="text-align: right;">Std.</th>
                </tr>
              </thead>
              <tbody>
                ${(data.watchTimeByVideo || []).map(v => `
                  <tr>
                    <td class="text-truncate" style="max-width: 300px;" title="${v.name}">
                      <a href="/w/${v.uuid}" target="_blank">${v.name}</a>
                    </td>
                    <td>${v.hours}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <div>
            <h3 style="color: #fff; font-size: 1.1rem; margin-bottom: 1rem; font-weight: 600;">🏆 Top 5 Most Viewed Videos</h3>
            <table class="stats-table">
              <thead>
                <tr>
                  <th>Video</th>
                  <th style="text-align: right;">Aufrufe</th>
                </tr>
              </thead>
              <tbody>
                ${(data.topVideos || []).map(v => `
                  <tr>
                    <td class="text-truncate" style="max-width: 300px;" title="${v.name}">
                      <a href="/w/${v.uuid}" target="_blank">${v.name}</a>
                    </td>
                    <td>${v.views}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

        </div>
      </div>
    `;

    container.insertAdjacentHTML('beforeend', detailsHtml);
  }

  renderDataCard(title, data, nameKey, valueKey) {
    if (!data || data.length === 0) {
      return `
        <div class="data-card">
          <div class="data-card-header">${title}</div>
          <div class="data-card-content" style="color: rgba(255,255,255,0.4);">No data/div>
        </div>
      `;
    }

    const items = data.slice(0, 5).map(item => `
      <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
        <span style="color: rgba(255,255,255,0.7);">${item[nameKey] || 'Unknown'}</span>
        <span style="color: #fff; font-weight: 600;">${item[valueKey]}</span>
      </div>
    `).join('');

    return `
      <div class="data-card">
        <div class="data-card-header">${title}</div>
        <div class="data-card-content">${items}</div>
      </div>
    `;
  }

  renderRegionsCard(data) {
    if (!data || data.length === 0) {
      return `
        <div class="data-card" style="grid-column: span 2;">
          <div class="data-card-header">🗺️ Top Regions</div>
          <div class="data-card-content" style="color: rgba(255,255,255,0.4);">Keine Daten</div>
        </div>
      `;
    }

    // Show top 10 regions
    const items = data.slice(0, 10).map(item => {
      const regionName = item.region === 'Unknown' ? 'Unknown' : item.region;
      const countryCode = item.country === 'Unknown' ? '' : ` (${item.country})`;
      const displayName = regionName + countryCode;

      return `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; padding: 0.25rem 0;">
          <div style="flex: 1; min-width: 0;">
            <div style="color: rgba(255,255,255,0.9); font-size: 0.85rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
              ${displayName}
            </div>
          </div>
          <div style="display: flex; gap: 1rem; margin-left: 1rem;">
            <span style="color: rgba(255,255,255,0.6); font-size: 0.75rem;">
              ${item.views} Views
            </span>
            <span style="color: #fff; font-weight: 600; font-size: 0.85rem;">
              ${item.uniqueViewers} 👤
            </span>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="data-card" style="grid-column: span 2;">
        <div class="data-card-header">🗺️ Top Regions</div>
        <div class="data-card-content">${items}</div>
      </div>
    `;
  }


  async loadVideoStats() {
    const container = document.getElementById('video-stats');
    const fromDate = document.getElementById('stats-from')?.value;
    const toDate = document.getElementById('stats-to')?.value;
    const groupBy = document.getElementById('stats-group')?.value;

    if (!container || !fromDate || !toDate) return;

    container.innerHTML = `
      <div class="loading-container">
        <div class="loading-spinner"></div>
        <p>Loading video statistics...</p>
      </div>
    `;

    try {
      const authHeader = this.peertubeHelpers.getAuthHeader();
      const params = new URLSearchParams({
        from: fromDate,
        to: toDate,
        groupBy: groupBy || 'day',
        includeWatchTimeStats: true
      });

      const response = await fetch(`/plugins/static-files/router/admin/stats?${params}`, {
        headers: authHeader || {}
      });

      const result = await response.json();

      if (result.status === 'success') {
        this.displayVideoStats(result.data, container);

        // NEW: Also render heatmap and retention distribution if data available
        if (result.data.activityHeatmap) {
          this.renderHeatmap(result.data.activityHeatmap);
        }
        if (result.data.watchTimePercentiles) {
          this.renderRetentionDistribution(result.data.watchTimePercentiles);
        }
        // NEW Phase 3: Render channels, categories, and fast-growing videos
        if (result.data.topChannels) {
          this.renderTopChannels(result.data.topChannels);
        }
        if (result.data.topCategories) {
          this.renderTopCategories(result.data.topCategories);
        }
        if (result.data.fastGrowingVideos) {
          this.renderFastGrowingVideos(result.data.fastGrowingVideos);
        }
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      container.innerHTML = `
      <div style="color: #ef4444; text-align: center; padding: 2rem;">
        <strong>Error:</strong> ${error.message}
      </div>
    `;
    }
  }

  renderHeatmap(heatmapData) {
    const container = document.getElementById('activity-heatmap');
    if (!container || !heatmapData || heatmapData.length === 0) return;

    // Days and hours labels
    const days = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
    const hours = Array.from({ length: 24 }, (_, i) => i);

    // Create data matrix (7 days × 24 hours)
    const matrix = Array(7).fill(null).map(() => Array(24).fill(0));

    // Fill matrix with data
    heatmapData.forEach(item => {
      if (item.dayOfWeek >= 0 && item.dayOfWeek <= 6 &&
        item.hourOfDay >= 0 && item.hourOfDay <= 23) {
        matrix[item.dayOfWeek][item.hourOfDay] = item.views;
      }
    });

    // Find max value for color scaling
    const maxViews = Math.max(...matrix.flat(), 1);

    // Calculate optimal cell size
    const cellSize = 30;
    const gap = 2;

    // Build heatmap HTML
    let html = `
    <div style="overflow-x: auto;">
      <div style="display: inline-block; min-width: 100%;">
        <!-- Hour labels -->
        <div style="display: flex; margin-left: ${cellSize + 10}px; margin-bottom: 5px;">
          ${hours.map(h => `
            <div style="width: ${cellSize}px; margin-right: ${gap}px; text-align: center; font-size: 0.7rem; color: rgba(255,255,255,0.5);">
              ${h}
            </div>
          `).join('')}
        </div>
        
        <!-- Heatmap grid -->
        ${days.map((day, dayIdx) => `
          <div style="display: flex; margin-bottom: ${gap}px;">
            <!-- Day label -->
            <div style="width: ${cellSize}px; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; color: rgba(255,255,255,0.7); font-weight: 600;">
              ${day}
            </div>
            <!-- Hour cells -->
            ${hours.map((hour) => {
      const views = matrix[dayIdx][hour];
      const intensity = views > 0 ? (views / maxViews) : 0;
      const bgColor = this.getHeatmapColor(intensity);

      return `
                <div 
                  style="
                    width: ${cellSize}px; 
                    height: ${cellSize}px; 
                    margin-right: ${gap}px;
                    background: ${bgColor};
                    border-radius: 4px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 0.7rem;
                    color: ${intensity > 0.5 ? '#fff' : 'rgba(255,255,255,0.6)'};
                    cursor: pointer;
                    transition: transform 0.2s;
                  "
                  title="${days[dayIdx]} ${hour}:00 - ${views} Views"
                  onmouseover="this.style.transform='scale(1.1)'"
                  onmouseout="this.style.transform='scale(1)'"
                >
                  ${views > 0 ? views : ''}
                </div>
              `;
    }).join('')}
          </div>
        `).join('')}
        
        <!-- Legend -->
        <div style="margin-top: 1.5rem; display: flex; align-items: center; gap: 1rem;">
          <span style="color: rgba(255,255,255,0.6); font-size: 0.85rem;">Fewer</span>
          ${[0, 0.25, 0.5, 0.75, 1].map(intensity => `
            <div style="width: 30px; height: 20px; background: ${this.getHeatmapColor(intensity)}; border-radius: 3px;"></div>
          `).join('')}
          <span style="color: rgba(255,255,255,0.6); font-size: 0.85rem;">More</span>
        </div>

        <!-- Best times recommendation -->
        ${this.getBestPublishingTimes(heatmapData)}
      </div>
    </div>
  `;

    container.innerHTML = html;
  }

  getHeatmapColor(intensity) {
    // Gradient from dark to bright blue
    const colors = [
      'rgba(59, 130, 246, 0.1)',   // 0%
      'rgba(59, 130, 246, 0.3)',   // 25%
      'rgba(59, 130, 246, 0.5)',   // 50%
      'rgba(59, 130, 246, 0.7)',   // 75%
      'rgba(59, 130, 246, 0.9)'    // 100%
    ];

    const index = Math.min(Math.floor(intensity * 5), 4);
    return colors[index];
  }

  getBestPublishingTimes(heatmapData) {
    if (!heatmapData || heatmapData.length === 0) return '';

    // Group by day and find top 3 hours per day
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const byDay = {};

    heatmapData.forEach(item => {
      if (!byDay[item.dayOfWeek]) byDay[item.dayOfWeek] = [];
      byDay[item.dayOfWeek].push(item);
    });

    // Get top hour for each day
    const recommendations = Object.keys(byDay).map(dayIdx => {
      const dayData = byDay[dayIdx].sort((a, b) => b.views - a.views);
      const topHour = dayData[0];
      return {
        day: days[topHour.dayOfWeek],
        hour: topHour.hourOfDay,
        views: topHour.views
      };
    }).sort((a, b) => b.views - a.views).slice(0, 3);

    if (recommendations.length === 0) return '';

    return `
    <div style="margin-top: 2rem; padding: 1.5rem; background: rgba(59, 130, 246, 0.1); border-left: 4px solid #3b82f6; border-radius: 8px;">
      <h4 style="color: #fff; font-size: 1rem; margin: 0 0 1rem 0; font-weight: 600;">
        💡 Best publication times
      </h4>
      <div style="display: flex; gap: 1.5rem; flex-wrap: wrap;">
        ${recommendations.map(rec => `
          <div>
            <div style="color: rgba(255,255,255,0.7); font-size: 0.85rem;">${rec.day}</div>
            <div style="color: #fff; font-size: 1.1rem; font-weight: 600;">${rec.hour}:00 Clock</div>
            <div style="color: rgba(255,255,255,0.5); font-size: 0.75rem;">${rec.views} Views</div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
  }

  renderRetentionDistribution(percentiles) {
    const container = document.getElementById('retention-distribution');
    if (!container || !percentiles) return;

    const formatTime = (seconds) => {
      if (seconds < 60) return `${seconds}s`;
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
    };

    const html = `
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1.5rem;">
      <div class="metric-card blue">
        <div class="metric-label">25th percentile</div>
        <div class="metric-value" style="font-size: 1.75rem;">${formatTime(percentiles.p25)}</div>
        <div class="metric-subtitle">25% watch less.</div>
      </div>
      <div class="metric-card green">
        <div class="metric-label">50th percentile (Median)</div>
        <div class="metric-value" style="font-size: 1.75rem;">${formatTime(percentiles.p50)}</div>
        <div class="metric-subtitle">Typical playback time</div>
      </div>
      <div class="metric-card cyan">
        <div class="metric-label">75th percentile</div>
        <div class="metric-value" style="font-size: 1.75rem;">${formatTime(percentiles.p75)}</div>
        <div class="metric-subtitle">75% watch less.</div>
      </div>
      <div class="metric-card orange">
        <div class="metric-label">90th percentile</div>
        <div class="metric-value" style="font-size: 1.75rem;">${formatTime(percentiles.p90)}</div>
        <div class="metric-subtitle">Engaged viewers</div>
      </div>
      <div class="metric-card purple">
        <div class="metric-label">95th percentile</div>
        <div class="metric-value" style="font-size: 1.75rem;">${formatTime(percentiles.p95)}</div>
        <div class="metric-subtitle">Top 5% viewers</div>
      </div>
    </div>

    <div style="margin-top: 2rem; padding: 1.5rem; background: rgba(16, 185, 129, 0.1); border-left: 4px solid #10b981; border-radius: 8px;">
      <h4 style="color: #fff; font-size: 1rem; margin: 0 0 0.5rem 0; font-weight: 600;">
        📈 Interpretation
      </h4>
      <p style="color: rgba(255,255,255,0.7); font-size: 0.9rem; margin: 0; line-height: 1.6;">
        Half of your viewers are watching. <strong style="color: #fff;">${formatTime(percentiles.p50)}</strong>or longer.
        The most dedicated 10% watch at least... <strong style="color: #fff;">${formatTime(percentiles.p90)}</strong>.
      </p>
    </div>
  `;

    container.innerHTML = html;
  }

  renderTopChannels(channels) {
    const container = document.getElementById('top-channels');
    if (!container) return;

    if (!channels || channels.length === 0) {
      container.innerHTML = '<p style="color: rgba(255,255,255,0.5); text-align: center; padding: 2rem;">No data</p>';
      return;
    }

    const html = `
      <table class="stats-table">
        <thead>
          <tr>
            <th>Kanal</th>
            <th style="text-align: center;">Videos</th>
            <th style="text-align: right;">Views</th>
            <th style="text-align: right;">Watch Time (Std.)</th>
          </tr>
        </thead>
        <tbody>
          ${channels.map(channel => `
            <tr>
              <td><strong>${channel.name}</strong></td>
              <td style="text-align: center;">${channel.videoCount}</td>
              <td style="text-align: right;">${channel.totalViews.toLocaleString()}</td>
              <td style="text-align: right;">${channel.watchHours}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    container.innerHTML = html;
  }

  async renderTopCategories(categories) {
    const container = document.getElementById('top-categories');
    if (!container) return;

    if (!categories || categories.length === 0) {
      container.innerHTML = '<p style="color: rgba(255,255,255,0.5); text-align: center; padding: 1rem;">No Categories</p>';
      return;
    }

    // Load category names dynamically from PeerTube API
    let categoryNames = {};
    try {
      const response = await fetch('/api/v1/videos/categories');
      if (response.ok) {
        categoryNames = await response.json(); // API returns object like {"1": "Music", "101": "Kurzfilm"}
      }
    } catch (e) {
      console.error('Could not load categories:', e);
    }


    const html = `
      <table class="stats-table">
        <thead>
          <tr>
            <th>Category</th>
            <th style="text-align: right;">Videos</th>
            <th style="text-align: right;">Views</th>
          </tr>
        </thead>
        <tbody>
          ${categories.map(cat => `
            <tr>
              <td>${categoryNames[cat.category] || `Category ${cat.category}`}</td>
              <td style="text-align: right;">${cat.videoCount}</td>
              <td style="text-align: right;">${cat.totalViews.toLocaleString()}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    container.innerHTML = html;
  }

  renderFastGrowingVideos(videos) {
    const container = document.getElementById('fast-growing-videos');
    if (!container) return;

    if (!videos || videos.length === 0) {
      container.innerHTML = '<p style="color: rgba(255,255,255,0.5); text-align: center; padding: 1rem;">No growing videos</p>';
      return;
    }

    const html = `
      <table class="stats-table">
        <thead>
          <tr>
            <th>Video</th>
            <th style="text-align: right;">Growth</th>
          </tr>
        </thead>
        <tbody>
          ${videos.map(video => {
      const growthPercent = video.oldViews > 0
        ? Math.round((video.growth / video.oldViews) * 100)
        : 100;

      return `
              <tr>
                <td class="text-truncate" style="max-width: 300px;" title="${video.name}">
                  <a href="/w/${video.uuid}" target="_blank">${video.name}</a>
                </td>
                <td style="text-align: right;">
                  <div style="display: flex; align-items: center; justify-content: flex-end; gap: 0.5rem;">
                    <span style="color: #10b981; font-weight: 600;">+${video.growth}</span>
                    <span style="color: rgba(255,255,255,0.5); font-size: 0.85rem;">(${growthPercent}%)</span>
                  </div>
                </td>
              </tr>
            `;
    }).join('')}
        </tbody>
      </table>
    `;

    container.innerHTML = html;
  }

  displayVideoStats(data, container) {
    const { videoViewsStats, watchTimeTimeSeries, activeViewersTimeSeries } = data;

    if (!videoViewsStats || videoViewsStats.length === 0) {
      container.innerHTML = `
        <div style="color: rgba(255,255,255,0.6); text-align: center; padding: 2rem;">
          <strong>No data:</strong> No video views were found for the selected time period.
        </div>
      `;
      return;
    }

    // Store data globally for chart switching
    window._statsData = {
      views: videoViewsStats,
      watchTime: watchTimeTimeSeries || [],
      activeViewers: activeViewersTimeSeries || []
    };

    container.innerHTML = `
      <!-- Chart Selector -->
      <div style="margin-bottom: 2rem;">
        <div style="display: flex; gap: 1rem; justify-content: center;">
          <button class="time-series-btn active" data-metric="views">
            📊 Views
          </button>
          <button class="time-series-btn" data-metric="watchTime">
            ⏱️ Watch Time
          </button>
          <button class="time-series-btn" data-metric="activeViewers">
            👥 Active Viewers
          </button>
        </div>
      </div>

      <!-- Chart Container -->
      <div id="time-series-chart"></div>

      <!-- Details Table -->
      <div style="margin-top: 2rem;">
        <h3 style="color: #fff; font-size: 1.1rem; margin-bottom: 1rem; font-weight: 600;">
          📅 Details by date
        </h3>
        <div id="time-series-table"></div>
      </div>
    `;

    // Add styles for chart selector buttons
    const style = document.createElement('style');
    style.textContent = `
      .time-series-btn {
        padding: 0.75rem 1.5rem;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 8px;
        color: rgba(255, 255, 255, 0.7);
        cursor: pointer;
        transition: all 0.2s;
        font-size: 0.9rem;
        font-weight: 500;
      }
      .time-series-btn:hover {
        background: rgba(255, 255, 255, 0.08);
        border-color: rgba(255, 255, 255, 0.25);
      }
      .time-series-btn.active {
        background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
        border-color: #3b82f6;
        color: #fff;
      }
    `;
    document.head.appendChild(style);

    // Initialize with views chart
    this.renderTimeSeriesChart('views');

    // Add event listeners for chart selector
    document.querySelectorAll('.time-series-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.time-series-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        this.renderTimeSeriesChart(e.target.dataset.metric);
      });
    });
  }

  renderTimeSeriesChart(metric) {
    const chartContainer = document.getElementById('time-series-chart');
    const tableContainer = document.getElementById('time-series-table');
    if (!chartContainer || !window._statsData) return;

    let labels, values, maxVal, unit, chartColor;

    if (metric === 'views') {
      const viewsData = window._statsData.views;
      labels = viewsData.map(s => s.date);
      values = viewsData.map(s => s.items.reduce((sum, item) => sum + item.views, 0));
      maxVal = Math.max(...values, 1);
      unit = 'Views';
      chartColor = '#3b82f6';
    } else if (metric === 'watchTime') {
      const watchTimeData = window._statsData.watchTime;
      labels = watchTimeData.map(s => s.date);
      values = watchTimeData.map(s => s.hours || 0);
      maxVal = Math.max(...values, 1);
      unit = 'Hours';
      chartColor = '#8b5cf6';
    } else if (metric === 'activeViewers') {
      const activeData = window._statsData.activeViewers;
      labels = activeData.map(s => s.date);
      values = activeData.map(s => s.uniqueViewers || 0);
      maxVal = Math.max(...values, 1);
      unit = 'Viewers';
      chartColor = '#ec4899';
    }

    // Render SVG chart
    const chartHeight = 250;
    const barWidth = 100 / values.length;

    let svgContent = '';
    values.forEach((val, idx) => {
      const height = (val / maxVal) * chartHeight;
      const x = idx * barWidth;
      const y = chartHeight - height;

      svgContent += `
        <rect x="${x}%" y="${y}" width="${barWidth - 1}%" height="${height}" 
              fill="${chartColor}" opacity="0.8" rx="2">
          <title>${labels[idx]}: ${val} ${unit}</title>
        </rect>
      `;
    });

    chartContainer.innerHTML = `
      <div class="chart-container">
        <h3 style="color: #fff; font-size: 1.1rem; margin-bottom: 1.5rem; font-weight: 600;">
          📈 ${unit} over time
        </h3>
        <div style="height: ${chartHeight}px; width: 100%; position: relative;">
          <svg width="100%" height="100%" preserveAspectRatio="none">
            ${svgContent}
          </svg>
        </div>
        <div style="display: flex; justify-content: space-between; margin-top: 1rem; color: rgba(255,255,255,0.5); font-size: 0.85rem;">
          <span>${labels[0] || ''}</span>
          <span>${labels[labels.length - 1] || ''}</span>
        </div>
      </div>
    `;

    // Render table based on metric
    let tableRows = '';
    if (metric === 'views') {
      window._statsData.views.forEach(stat => {
        const totalViews = stat.items.reduce((sum, item) => sum + item.views, 0);
        tableRows += `
          <tr>
            <td><strong>${stat.date}</strong></td>
            <td>${stat.items.length} Videos</td>
            <td>${totalViews.toLocaleString()} Views</td>
          </tr>
        `;
      });
    } else if (metric === 'watchTime') {
      window._statsData.watchTime.forEach(stat => {
        tableRows += `
          <tr>
            <td><strong>${stat.date}</strong></td>
            <td>${stat.hours.toFixed(1)} Hours</td>
            <td>${stat.seconds.toLocaleString()} seconds</td>
          </tr>
        `;
      });
    } else if (metric === 'activeViewers') {
      window._statsData.activeViewers.forEach(stat => {
        tableRows += `
          <tr>
            <td><strong>${stat.date}</strong></td>
            <td colspan="2">${stat.uniqueViewers} Unique viewers</td>
          </tr>
        `;
      });
    }

    tableContainer.innerHTML = `
      <table class="stats-table">
        <thead>
          <tr>
            <th>Date</th>
            <th colspan="2">${unit}</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
    `;
  }
}

// Export for client usage
if (typeof module !== 'undefined' && module.exports) {
  } else {
  window.StatsPage = StatsPage;
}