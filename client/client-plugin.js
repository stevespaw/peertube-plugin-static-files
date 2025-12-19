async function register({ registerClientRoute, registerHook, peertubeHelpers }) {
  console.log('Static Files Plugin: client registering...')

  const { notifier } = peertubeHelpers

  // INTEGRATION INTO THE LEFT MENU VIA PEERTUBE HOOK
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

        // Checking access to the plugin
        const accessData = await checkStaticFilesAccess()
        if (!accessData.hasAccess) {
          console.log('Static Files: No access to plugin, returning default links')
          return defaultLinks
        }

        console.log('Static Files: Adding menu section for user:', accessData.user.username)

        // Create a section Static Files
        const staticFilesSection = {
          key: 'static-files',
          title: 'Static Files',
          links: []
        }

        // Add a link to download files (for everyone with access)
        if (accessData.hasAccess) {
          staticFilesSection.links.push({
            icon: 'upload',
            label: 'Data-Upload',
            path: `/p/${accessData.uploadPath}`,
            isPrimaryButton: false
          })
        }

        // Adding links for admins
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

    // Загрузка файла
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

    // Delete file
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

      // Checking access to...API
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
        console.error('Error during API call:', error)
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
        document.title = `Data-Upload - ${config.instance.name}`
      } catch (e) {
        document.title = 'Data-Upload'
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

        <!-- Title -->
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
                  <span class="sr-only">Loading...</span>
                </div>
                <p class="mt-2">Loading Statistics...</p>
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
          <p class="text-muted">No files available</p>
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
          <strong>In total:</strong> ${files.length} Files • 
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
                      onclick="copyAdminFileLink('${file.url}')" title="Copy link">
                📋 Copy
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

  // STATISTICS UPDATE
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
    if (!confirm('Do you really want to clean up orphaned files?\n\nThis will delete all files that are older than 30 days and do not have metadata.')) {
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
        showMessage(`❌ Error: ${result.error || 'Error: Cleanup failed:'}`, 'error')
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

  // Statistics (GLOBAL FUNCTIONS FOR THE ADMIN INTERFACE)
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
            <div id="progress-text" style="margin-top: 5px; font-size: 0.9rem;">Vorbereitung...</div>
          </div>
        </div>
      `

      const progressBar = document.getElementById('progress-bar')
      const progressText = document.getElementById('progress-text')
      let completed = 0

      for (const file of files) {
        try {
          progressText.textContent = `Load "${file.name}" high...`

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

        // Checking the response status.
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
                errorMessage = `File "${file.name}" is too large (${Math.round(file.size / 1024 / 1024 * 10) / 10}MB). Maximum allowed: 100MB. The Nginx limit might also be too low.`
              }
            } catch (textError) {
              // Fallback
              if (response.status === 413) {
                errorMessage = `File "${file.name}" is too large (${Math.round(file.size / 1024 / 1024 * 10) / 10}MB). Server limit reached.`
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