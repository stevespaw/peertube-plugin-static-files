async function register({ registerClientRoute, registerHook, peertubeHelpers }) {
  console.log('Static Files Plugin: client registering...')

  const { notifier } = peertubeHelpers

  // ИНТЕГРАЦИЯ В ЛЕВОЕ МЕНЮ ЧЕРЕЗ ХУК PEERTUBE
  registerHook({
    target: 'filter:left-menu.links.create.result',
    handler: async (defaultLinks) => {
      console.log('Static Files: Processing menu links via hook...')

      try {
        // Проверяем авторизацию
        if (!peertubeHelpers.isLoggedIn()) {
          console.log('Static Files: User not logged in, returning default links')
          return defaultLinks
        }

        // Проверяем доступ к плагину
        const accessData = await checkStaticFilesAccess()
        if (!accessData.hasAccess) {
          console.log('Static Files: No access to plugin, returning default links')
          return defaultLinks
        }

        console.log('Static Files: Adding menu section for user:', accessData.user.username)

        // Создаем секцию Static Files
        const staticFilesSection = {
          key: 'static-files',
          title: 'Static Files',
          links: []
        }

        // Добавляем ссылку на загрузку файлов (для всех с доступом)
        if (accessData.hasAccess) {
          staticFilesSection.links.push({
            icon: 'upload',
            label: 'Datei-Upload',
            path: `/p/${accessData.uploadPath}`,
            isPrimaryButton: false
          })
        }

        // Добавляем ссылки для админов
        if (accessData.isAdmin) {
          staticFilesSection.links.push({
            icon: 'cog', // Используем 'cog' для админки
            label: 'Datei-Verwaltung',
            path: '/p/files/admin',
            isPrimaryButton: false
          })

          staticFilesSection.links.push({
            icon: 'stats',
            label: 'Admin Statistiken',
            path: '/p/admin/stats',
            isPrimaryButton: false
          })
        }

        // Добавляем нашу секцию к существующим ссылкам
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

  // ФУНКЦИЯ ПРОВЕРКИ ДОСТУПА (упрощенная для хука)
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

  // Глобальные утилиты для работы с файлами
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
          notifier.success('Datei erfolgreich hochgeladen')
          return result.file
        } else {
          throw new Error(result.error || 'Unbekannter Fehler')
        }
      } catch (error) {
        notifier.error('Fehler beim Hochladen: ' + error.message)
        throw error
      }
    },

    // Все Dateien abrufen
    async getFiles() {
      try {
        const authHeader = peertubeHelpers.getAuthHeader()
        const response = await fetch('/plugins/static-files/router/files', {
          headers: authHeader || {}
        })

        const result = await response.json()
        return result.files || []
      } catch (error) {
        notifier.error('Fehler beim Laden der Dateien: ' + error.message)
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
          notifier.success('Datei erfolgreich gelöscht')
          return true
        } else {
          throw new Error(result.error || 'Unbekannter Fehler')
        }
      } catch (error) {
        notifier.error('Fehler beim Löschen: ' + error.message)
        throw error
      }
    },

    // Hilfsfunktionen
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
        notifier.success('Link in Zwischenablage kopiert')
      } catch (error) {
        // Fallback für ältere Browser
        const textArea = document.createElement('textarea')
        textArea.value = text
        document.body.appendChild(textArea)
        textArea.select()
        document.execCommand('copy')
        document.body.removeChild(textArea)
        notifier.success('Link in Zwischenablage kopiert')
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

  // Получаем настройки плагина
  const settings = await peertubeHelpers.getSettings()
  const uploadPath = settings['page-path'] || 'files/upload'

  // 1. РЕГИСТРАЦИЯ МАРШРУТА ДЛЯ ОБЫЧНЫХ ПОЛЬЗОВАТЕЛЕЙ - ЗАГРУЗКА ФАЙЛОВ
  registerClientRoute({
    route: uploadPath,
    onMount: async ({ rootEl }) => {
      console.log('Static Files: upload route mounted')

      // Проверяем авторизацию
      if (!peertubeHelpers.isLoggedIn()) {
        rootEl.innerHTML = `
          <div class="margin-content col-md-12 col-xl-8" style="padding-top: 30px;">
            <div style="text-align: center; padding: 40px; font-family: sans-serif;">
              <h2>🔒 Anmeldung erforderlich</h2>
              <p>Sie müssen angemeldet sein, um diese Seite zu nutzen.</p>
              <a href="/login" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">
                Anmelden
              </a>
            </div>
          </div>
        `
        return
      }

      // Проверяем доступ к API
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
              <h2>⚠️ Fehler</h2>
              <p>Fehler beim Laden der Seite: ${error.message}</p>
              <button onclick="location.reload()" style="background: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer;">
                Seite neu laden
              </button>
            </div>
          </div>
        `
      }

      // Устанавливаем заголовок страницы
      try {
        const config = await peertubeHelpers.getServerConfig()
        document.title = `Datei-Upload - ${config.instance.name}`
      } catch (e) {
        document.title = 'Datei-Upload'
      }
    }
  })

  // 2. РЕГИСТРАЦИЯ МАРШРУТА ДЛЯ АДМИНОВ - УПРАВЛЕНИЕ ФАЙЛАМИ
  registerClientRoute({
    route: 'files/admin',
    onMount: async ({ rootEl }) => {
      console.log('Static Files: admin route mounted')

      // Проверяем авторизацию
      if (!peertubeHelpers.isLoggedIn()) {
        rootEl.innerHTML = `
          <div class="margin-content col-md-12 col-xl-8" style="padding-top: 30px;">
            <div style="text-align: center; padding: 40px; font-family: sans-serif;">
              <h2>🔒 Anmeldung erforderlich</h2>
              <p>Sie müssen angemeldet sein, um diese Seite zu nutzen.</p>
              <a href="/login" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">
                Anmelden
              </a>
            </div>
          </div>
        `
        return
      }

      // Проверяем доступ к админ-функциям
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
        console.error('Fehler bei Admin-API-Aufruf:', error)
        rootEl.innerHTML = `
          <div class="margin-content col-md-12 col-xl-8" style="padding-top: 30px;">
            <div style="text-align: center; padding: 40px; font-family: sans-serif;">
              <h2>⚠️ Fehler</h2>
              <p>Fehler beim Laden der Admin-Seite: ${error.message}</p>
              <button onclick="location.reload()" style="background: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer;">
                Seite neu laden
              </button>
            </div>
          </div>
        `
      }

      // Устанавливаем заголовок страницы
      try {
        const config = await peertubeHelpers.getServerConfig()
        document.title = `Datei-Verwaltung - ${config.instance.name}`
      } catch (e) {
        document.title = 'Datei-Verwaltung'
      }
    }
  })

  // StatsPage class is now loaded from stats-page.js

  // 3. РЕГИСТРАЦИЯ МАРШРУТА ДЛЯ АДМИНСКОЙ СТАТИСТИКИ
  registerClientRoute({
    route: 'admin/stats',
    onMount: async ({ rootEl }) => {
      console.log('Static Files: admin stats route mounted')

      // Проверяем авторизацию
      if (!peertubeHelpers.isLoggedIn()) {
        rootEl.innerHTML = `
          <div class="margin-content col-md-12 col-xl-8" style="padding-top: 30px;">
            <div style="text-align: center; padding: 40px; font-family: sans-serif;">
              <h2>🔒 Anmeldung erforderlich</h2>
              <p>Sie müssen angemeldet sein, um diese Seite zu nutzen.</p>
              <a href="/login" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">
                Anmelden
              </a>
            </div>
          </div>
        `
        return
      }

      // Проверяем доступ к админ-функциям
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
          // Создаем экземпляр StatsPage и показываем страницу
          const statsPage = new StatsPage(peertubeHelpers)
          await statsPage.showPage({ rootEl })
        } else {
          showAccessDenied(rootEl)
        }
      } catch (error) {
        console.error('Fehler bei Stats-API-Aufruf:', error)
        rootEl.innerHTML = `
          <div class="margin-content col-md-12 col-xl-8" style="padding-top: 30px;">
            <div style="text-align: center; padding: 40px; font-family: sans-serif;">
              <h2>⚠️ Fehler</h2>
              <p>Fehler beim Laden der Statistiken: ${error.message}</p>
              <button onclick="location.reload()" style="background: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer;">
                Seite neu laden
              </button>
            </div>
          </div>
        `
      }

      // Устанавливаем заголовок страницы
      try {
        const config = await peertubeHelpers.getServerConfig()
        document.title = `Instance Statistiken - ${config.instance.name}`
      } catch (e) {
        document.title = 'Instance Statistiken'
      }
    }
  })

  function showAccessDenied(rootEl) {
    rootEl.innerHTML = `
      <div class="margin-content col-md-12 col-xl-8" style="padding-top: 30px;">
        <div style="text-align: center; padding: 40px; font-family: sans-serif;">
          <h2>🚫 Zugriff verweigert</h2>
          <p>Sie haben keine Berechtigung für diese Seite.</p>
          <p>Wenden Sie sich an einen Administrator.</p>
        </div>
      </div>
    `
  }

  // ФУНКЦИЯ СОЗДАНИЯ ИНТЕРФЕЙСА ЗАГРУЗКИ (для обычных пользователей)
  function createUploadInterface(rootEl, accessData) {
    const { settings, user } = accessData

    rootEl.innerHTML = `
      <div class="container margin-content col-md-12 col-xl-10 pt-4">

        <div class="card mb-4">
          <div class="card-body text-center">
            <h1 class="card-title">📁 Datei-Upload</h1>
            <p class="card-text">Willkommen, <strong>${user.username}</strong>!</p>
          </div>
        </div>

        <div class="card mb-4">
          <div class="card-body">
            <h3 class="card-title">📤 Dateien hochladen</h3>

            <div id="drop-zone" class="upload-drop-zone mb-3">
              <div>
                <div class="display-4 text-primary mb-3">☁️</div>
                <h4 class="text-muted">Dateien hier hineinziehen</h4>
                <p class="text-muted">oder klicken zum Auswählen</p>
                <p class="small text-muted">
                  <strong>Erlaubte Typen:</strong> ${getFileTypesText(settings.allowedFileTypes).replace('ICO', 'ICO, SVG')}<br>
                  <strong>Max. Größe:</strong> ${settings.maxFileSize}MB
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
            <h3 class="card-title">📋 Meine Dateien</h3>
            <div id="files-list">
              <div class="text-center text-muted p-4">
                <div class="display-4">⏳</div>
                <p>Dateien werden geladen...</p>
              </div>
            </div>
          </div>
        </div>

      </div>
    `

    initializeUpload(settings)
  }

  // ФУНКЦИЯ СОЗДАНИЯ АДМИН-ИНТЕРФЕЙСА (для администраторов)
  function createAdminInterface(rootEl, accessData) {
    const { user } = accessData

    rootEl.innerHTML = `
      <div class="container margin-content col-md-12 col-xl-10 pt-4">

        <!-- Заголовок -->
        <div class="card mb-4">
          <div class="card-body">
            <div class="d-flex justify-content-between align-items-center">
              <div>
                <h1 class="card-title mb-1">📁 Datei-Verwaltung (Admin)</h1>
                <p class="card-text text-muted">Willkommen, <strong>${user.username}</strong> (${user.roleText})</p>
              </div>
              <div>
                <a href="/p/${uploadPath}" class="btn btn-outline-primary">
                  📤 Zum Upload
                </a>
              </div>
            </div>
          </div>
        </div>

        <!-- Управляющие кнопки -->
        <div class="card mb-4">
          <div class="card-body">
            <h3 class="card-title">🛠️ Verwaltung</h3>
            <div class="btn-group" role="group">
              <button id="admin-refresh-btn" class="btn btn-primary">
                🔄 Dateien aktualisieren
              </button>
              <button id="admin-cleanup-btn" class="btn btn-warning">
                🧹 Aufräumen
              </button>
              <button id="admin-stats-btn" class="btn btn-info">
                📊 Statistiken
              </button>
            </div>
          </div>
        </div>

        <!-- Статистика (скрытая по умолчанию) -->
        <div id="admin-stats" class="card mb-4" style="display: none;">
          <div class="card-body">
            <h3 class="card-title">📊 Statistiken</h3>
            <div id="stats-content" class="row">
              <div class="col-12 text-center">
                <div class="spinner-border text-primary" role="status">
                  <span class="sr-only">Lädt...</span>
                </div>
                <p class="mt-2">Lade Statistiken...</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Список файлов -->
        <div class="card">
          <div class="card-body">
            <h3 class="card-title">📋 Alle Dateien</h3>
            <div id="admin-files-container">
              <div class="text-center p-4">
                <div class="spinner-border text-primary" role="status">
                  <span class="sr-only">Lädt...</span>
                </div>
                <p class="mt-2">Lade Dateien...</p>
              </div>
            </div>
          </div>
        </div>

      </div>
    `

    initializeAdminInterface()
  }

  // ИНИЦИАЛИЗАЦИЯ АДМИН-ИНТЕРФЕЙСА
  function initializeAdminInterface() {
    // Обработчики кнопок
    document.getElementById('admin-refresh-btn')?.addEventListener('click', loadAdminFiles)
    document.getElementById('admin-cleanup-btn')?.addEventListener('click', handleAdminCleanup)
    document.getElementById('admin-stats-btn')?.addEventListener('click', toggleAdminStats)

    // Загружаем файлы при инициализации
    loadAdminFiles()
  }

  // ЗАГРУЗКА ФАЙЛОВ ДЛЯ АДМИНА
  async function loadAdminFiles() {
    const container = document.getElementById('admin-files-container')
    if (!container) return

    container.innerHTML = `
      <div class="text-center p-4">
        <div class="spinner-border text-primary" role="status">
          <span class="sr-only">Lädt...</span>
        </div>
        <p class="mt-2">Lade Dateien...</p>
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
      console.error('Fehler beim Laden der Admin-Dateien:', error)
      container.innerHTML = `
        <div class="alert alert-danger">
          <h5>⚠️ Fehler beim Laden der Dateien</h5>
          <p><strong>Details:</strong> ${error.message}</p>
          <button class="btn btn-outline-danger btn-sm" onclick="window.loadAdminFiles()">
            🔄 Erneut versuchen
          </button>
        </div>
      `
    }
  }

  // ОТОБРАЖЕНИЕ ФАЙЛОВ ДЛЯ АДМИНА
  function displayAdminFiles(files, stats) {
    const container = document.getElementById('admin-files-container')
    if (!container) return

    if (files.length === 0) {
      container.innerHTML = `
        <div class="text-center p-5">
          <div style="font-size: 4rem;">📂</div>
          <h4 class="mt-3">Keine Dateien vorhanden</h4>
          <p class="text-muted">Es wurden noch keine Dateien hochgeladen.</p>
        </div>
      `
      updateAdminStats(stats)
      return
    }

    // Обновляем статистику
    updateAdminStats(stats)

    // Сортируем файлы по дате загрузки (новые сначала)
    files.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate))

    let html = `
      <div class="mb-3">
        <p class="text-muted">
          <strong>Gesamt:</strong> ${files.length} Dateien • 
          <strong>Größe:</strong> ${formatFileSize(stats.totalSize || 0)} • 
          <strong>Mit Metadaten:</strong> ${stats.withMetadata || 0} • 
          <strong>Ohne Metadaten:</strong> ${stats.withoutMetadata || 0}
        </p>
      </div>
    `

    files.forEach(file => {
      const statusClass = file.hasMetadata ? 'status-with-metadata' : 'status-without-metadata'
      const statusText = file.hasMetadata ? 'Mit Metadaten' : 'Ohne Metadaten'
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
                <div>📏 <strong>Größe:</strong> ${formatFileSize(file.size)}</div>
                <div>📅 <strong>Hochgeladen:</strong> ${formatDate(file.uploadDate)}</div>
                <div>👤 <strong>Von:</strong> ${file.uploadedBy}</div>
                <div>📂 <strong>Kategorie:</strong> ${file.category}</div>
                <div>🗂️ <strong>MIME:</strong> ${file.mimetype}</div>
              </div>
            </div>

            <div class="file-actions">
              <button class="btn btn-outline-primary btn-sm" 
                      onclick="previewAdminFile('${file.url}')" title="Vorschau">
                👁️ Ansehen
              </button>
              <button class="btn btn-outline-secondary btn-sm" 
                      onclick="copyAdminFileLink('${file.url}')" title="Link kopieren">
                📋 Kopieren
              </button>
              <button class="btn btn-outline-info btn-sm" 
                      onclick="downloadAdminFile('${file.url}', '${file.filename}')" title="Herunterladen">
                💾 Download
              </button>
              <button class="btn btn-outline-danger btn-sm" 
                      onclick="deleteAdminFile('${file.category}', '${file.filename}')" title="Löschen">
                🗑️ Löschen
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
            <div>📁 Gesamt</div>
          </div>
        </div>
      </div>
      <div class="col-md-3 mb-3">
        <div class="card bg-success text-white">
          <div class="card-body text-center">
            <div class="stats-number">${stats.withMetadata || 0}</div>
            <div>✅ Mit Metadaten</div>
          </div>
        </div>
      </div>
      <div class="col-md-3 mb-3">
        <div class="card bg-warning text-white">
          <div class="card-body text-center">
            <div class="stats-number">${stats.withoutMetadata || 0}</div>
            <div>❌ Ohne Metadaten</div>
          </div>
        </div>
      </div>
      <div class="col-md-3 mb-3">
        <div class="card bg-info text-white">
          <div class="card-body text-center">
            <div class="stats-number">${formatFileSize(stats.totalSize || 0)}</div>
            <div>💾 Größe</div>
          </div>
        </div>
      </div>
    `
  }

  // ОЧИСТКА ФАЙЛОВ (АДМИН)
  async function handleAdminCleanup() {
    if (!confirm('Wirklich verwaiste Dateien aufräumen?\n\nDies wird alle Dateien löschen, die älter als 30 Tage sind und keine Metadaten haben.')) {
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
        showMessage(`✅ Erfolgreich: ${result.message}`, 'success')
        loadAdminFiles() // Обновляем список
      } else {
        showMessage(`❌ Fehler: ${result.error || 'Aufräumen fehlgeschlagen'}`, 'error')
      }
    } catch (error) {
      showMessage(`❌ Fehler beim Aufräumen: ${error.message}`, 'error')
    }
  }

  // ПЕРЕКЛЮЧЕНИЕ СТАТИСТИКИ
  function toggleAdminStats() {
    const statsDiv = document.getElementById('admin-stats')
    if (statsDiv) {
      const isVisible = statsDiv.style.display !== 'none'
      statsDiv.style.display = isVisible ? 'none' : 'block'

      const btn = document.getElementById('admin-stats-btn')
      if (btn) {
        btn.textContent = isVisible ? '📊 Statistiken' : '📊 Statistiken ausblenden'
      }
    }
  }

  // ГЛОБАЛЬНЫЕ ФУНКЦИИ ДЛЯ АДМИН-ИНТЕРФЕЙСА
  window.loadAdminFiles = loadAdminFiles

  window.deleteAdminFile = async function (category, filename) {
    if (!confirm(`Datei "${filename}" wirklich löschen?`)) {
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
        showMessage('✅ Datei erfolgreich gelöscht', 'success')
        loadAdminFiles() // Обновляем список
      } else {
        showMessage(`❌ Fehler: ${result.error || 'Löschen fehlgeschlagen'}`, 'error')
      }
    } catch (error) {
      showMessage(`❌ Fehler beim Löschen: ${error.message}`, 'error')
    }
  }

  window.previewAdminFile = function (url) {
    window.open(window.location.origin + url, '_blank')
  }

  window.copyAdminFileLink = async function (url) {
    const fullUrl = window.location.origin + url
    try {
      await navigator.clipboard.writeText(fullUrl)
      showMessage('✅ Link in Zwischenablage kopiert!', 'success')
    } catch (error) {
      // Fallback für ältere Browser
      const textarea = document.createElement('textarea')
      textarea.value = fullUrl
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      showMessage('✅ Link in Zwischenablage kopiert!', 'success')
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

  // ИНИЦИАЛИЗАЦИЯ ЗАГРУЗКИ ФАЙЛОВ (для обычных пользователей)
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
          <strong>Upload läuft...</strong>
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
          progressText.textContent = `Lade "${file.name}" hoch...`

          await uploadFile(file)
          completed++

          const progress = (completed / files.length) * 100
          progressBar.style.width = progress + '%'
          progressText.textContent = `${completed} von ${files.length} Dateien hochgeladen`

        } catch (error) {
          console.error('Upload error:', error)
          showMessage(`Fehler bei "${file.name}": ${error.message}`, 'error')
        }
      }

      setTimeout(() => {
        uploadStatus.style.display = 'none'
        loadFiles()
        showMessage(`${completed} Datei(en) erfolgreich hochgeladen!`, 'success')
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

        // Проверяем статус ответа
        if (!response.ok) {
          let errorMessage = `HTTP ${response.status}: ${response.statusText}`

          // Исправление: сначала клонируем response для повторного чтения
          const responseClone = response.clone()

          try {
            const errorData = await response.json()
            if (errorData.error) {
              errorMessage = errorData.error

              // Специальная обработка для ошибок размера файла
              if (errorData.errorCode === 'FILE_TOO_LARGE' || errorData.errorCode === 'FIELD_TOO_LARGE') {
                errorMessage = `Datei "${file.name}" ist zu groß. Maximum: ${errorData.maxSize}MB`
              }
            }
          } catch (parseError) {
            // Если не удалось распарсить JSON, используем клонированный response
            try {
              const htmlResponse = await responseClone.text()
              if (response.status === 413 || htmlResponse.includes('413') || htmlResponse.includes('too large')) {
                errorMessage = `Datei "${file.name}" ist zu groß (${Math.round(file.size / 1024 / 1024 * 10) / 10}MB). Maximum erlaubt: 100MB. Möglicherweise ist auch das Nginx-Limit zu niedrig.`
              }
            } catch (textError) {
              // Fallback
              if (response.status === 413) {
                errorMessage = `Datei "${file.name}" ist zu groß (${Math.round(file.size / 1024 / 1024 * 10) / 10}MB). Server-Limit erreicht.`
              }
            }
          }

          throw new Error(errorMessage)
        }

        const result = await response.json()

        if (result.success) {
          return result.file
        } else {
          throw new Error(result.error || 'Upload fehlgeschlagen')
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
              <h4>Keine Dateien vorhanden</h4>
              <p>Laden Sie Ihre erste Datei hoch!</p>
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
                    ${formatFileSize(file.size)} • ${formatDate(file.uploadDate)}${file.uploadedBy ? ` • von ${file.uploadedBy}` : ''}
                  </div>
                </div>
              </div>

              <div class="btn-group btn-group-sm" role="group">
                <button class="btn btn-outline-secondary" onclick="copyLink('${file.url}')" title="Link kopieren">📋</button>
                <button class="btn btn-outline-primary" onclick="openFile('${file.url}')" title="Ansehen">👁️</button>
                <button class="btn btn-outline-danger" onclick="deleteFile('${file.category}', '${file.filename}')" title="Löschen">🗑️</button>
              </div>

            </div>
          </div>
        `).join('')

      } catch (error) {
        console.error('Load files error:', error)
        filesList.innerHTML = `
          <div class="error-message">
            <strong>Fehler beim Laden der Dateien</strong><br>
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
        showMessage('Link in Zwischenablage kopiert!', 'success')
      } catch (error) {
        // Fallback
        const textarea = document.createElement('textarea')
        textarea.value = fullUrl
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
        showMessage('Link in Zwischenablage kopiert!', 'success')
      }
    }

    window.openFile = function (url) {
      window.open(window.location.origin + url, '_blank')
    }

    window.deleteFile = async function (category, filename) {
      if (!confirm(`Datei "${filename}" wirklich löschen?`)) return

      try {
        const response = await fetch(`/plugins/static-files/router/file/${category}/${filename}`, {
          method: 'DELETE',
          headers: peertubeHelpers.getAuthHeader() || {}
        })

        const result = await response.json()

        if (result.success) {
          showMessage('Datei erfolgreich gelöscht', 'success')
          loadFiles()
        } else {
          throw new Error(result.error || 'Löschen fehlgeschlagen')
        }
      } catch (error) {
        showMessage('Fehler beim Löschen: ' + error.message, 'error')
      }
    }

    // Загружаем файлы при инициализации
    loadFiles()
  }

  // УТИЛИТЫ
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

// ВАЖНО: Именованный экспорт!
export {
  register
}