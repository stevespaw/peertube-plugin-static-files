const fs = require('fs')
const path = require('path')
const multer = require('multer')
const mime = require('mime-types')
const StatsRoutes = require('./routes/stats');

function getAuthToken(req) {
  let token = null;

  if (req.headers.authorization) {
    const authHeader = req.headers.authorization;
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else {
      token = authHeader;
    }
  }

  if (!token && req.headers.cookie) {
    const cookies = req.headers.cookie.split(';');
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === 'access_token' || name === 'peertube_access_token') {
        token = value;
        break;
      }
    }
  }

  return token;
}

async function register({
  peertubeHelpers,
  registerHook,
  registerSetting,
  settingsManager,
  storageManager,
  videoCategoryManager,
  videoLicenceManager,
  videoLanguageManager,
  getRouter
}) {
  const logger = peertubeHelpers.logger

  logger.info('🚀 Static Files Plugin wird registriert...')

  const dataDir = peertubeHelpers.plugin.getDataDirectoryPath()
  const metadataPath = path.join(dataDir, 'metadata')
  const uploadsPath = path.join(dataDir, 'uploads')
  const imagesPath = path.join(uploadsPath, 'images')
  const documentsPath = path.join(uploadsPath, 'documents')

  logger.info(`📂 Data directory: ${dataDir}`)

  try {
    if (!fs.existsSync(uploadsPath)) {
      fs.mkdirSync(uploadsPath, { recursive: true })
      logger.info('📁 Uploads-Verzeichnis erstellt')
    }
    if (!fs.existsSync(imagesPath)) {
      fs.mkdirSync(imagesPath, { recursive: true })
      logger.info('📁 Images-Verzeichnis erstellt')
    }
    if (!fs.existsSync(documentsPath)) {
      fs.mkdirSync(documentsPath, { recursive: true })
      logger.info('📁 Documents-Verzeichnis erstellt')
    }
    if (!fs.existsSync(metadataPath)) {
      fs.mkdirSync(metadataPath, { recursive: true })
      logger.info('📁 Metadata-Verzeichnis erstellt')
    }
  } catch (error) {
    logger.error('Fehler beim Erstellen der Verzeichnisse:', error)
  }

  async function saveFileMetadata(filename, metadata) {
    try {
      const metadataFile = path.join(metadataPath, `${filename}.json`)
      fs.writeFileSync(metadataFile, JSON.stringify(metadata, null, 2))
      console.log(`🗃️ Метаданные сохранены в файл: ${metadataFile}`)
      return true
    } catch (error) {
      console.error(`🗃️ Ошибка сохранения метаданных для ${filename}:`, error)
      return false
    }
  }

  async function loadFileMetadata(filename) {
    try {
      const metadataFile = path.join(metadataPath, `${filename}.json`)
      if (fs.existsSync(metadataFile)) {
        const data = fs.readFileSync(metadataFile, 'utf8')
        return JSON.parse(data)
      }
      return null
    } catch (error) {
      console.error(`🗃️ Ошибка загрузки метаданных для ${filename}:`, error)
      return null
    }
  }

  // Регистрируем настройки для админ-панели
  registerSetting({
    name: 'enable-plugin',
    label: 'Plugin aktivieren',
    type: 'input-checkbox',
    default: true,
    private: false,
    descriptionHTML: 'Aktiviert oder deaktiviert das gesamte Plugin'
  })

  registerSetting({
    name: 'page-path',
    label: 'Pfad zur Upload-Seite (ohne /)',
    type: 'input',
    default: 'files/upload',
    descriptionHTML: 'Die Seite wird unter https://ihre-domain.de/p/{pfad} verfügbar sein',
    private: false
  })

  registerSetting({
    name: 'allowed-users',
    label: 'Berechtigte Benutzer (durch Komma getrennt)',
    type: 'input-textarea',
    default: '',
    descriptionHTML: 'Benutzernamen durch Komma getrennt. Leer = alle angemeldeten Benutzer haben Zugriff',
    private: false
  })

  registerSetting({
    name: 'allowed-roles',
    label: 'Berechtigte Rollen',
    type: 'select',
    options: [
      { label: 'Alle angemeldeten Benutzer', value: 'all' },
      { label: 'Nur Administratoren', value: 'admin' },
      { label: 'Administratoren und Moderatoren', value: 'admin-mod' }
    ],
    default: 'all',
    private: false
  })

  registerSetting({
    name: 'allowed-file-types',
    label: 'Erlaubte Dateitypen',
    type: 'select',
    options: [
      { label: 'Alle (Bilder + Dokumente)', value: 'all' },
      { label: 'Nur Bilder (JPG, PNG, GIF, WebP)', value: 'images' },
      { label: 'Nur Dokumente (PDF, TXT, DOC, DOCX)', value: 'documents' }
    ],
    default: 'all',
    private: false
  })

  registerSetting({
    name: 'max-file-size',
    label: 'Maximale Dateigröße (MB)',
    type: 'input',
    default: '50',
    descriptionHTML: 'Maximale Größe pro Datei in Megabytes',
    private: false
  })

  // УПРОЩЕННАЯ АДМИН-НАСТРОЙКА - ПРОСТО ССЫЛКА НА ОТДЕЛЬНУЮ СТРАНИЦУ
  registerSetting({
    name: 'admin-interface-link',
    label: 'Dateiverwaltung',
    type: 'html',
    html: `
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px; text-align: center;">
        <h4 style="margin: 0 0 15px 0;">📁 Datei-Verwaltung</h4>
        <p style="margin: 0 0 20px 0;">Verwalten Sie alle hochgeladenen Dateien in einer separaten Admin-Oberfläche.</p>
        <a href="/p/files/admin" target="_blank" 
           style="background: white; color: #667eea; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
          🚀 Zur Dateiverwaltung
        </a>
        <p style="margin: 15px 0 0 0; font-size: 0.9em; opacity: 0.9;">
          <strong>Hinweis:</strong> Diese Seite öffnet sich in einem neuen Tab und zeigt alle Dateien, Statistiken und Verwaltungsoptionen.
        </p>
      </div>
      
      <div style="margin-top: 20px; padding: 15px; background: #f8f9fa; border-radius: 6px; border-left: 4px solid #17a2b8;">
        <h5 style="color: #17a2b8; margin: 0 0 10px 0;">ℹ️ Funktionen der Dateiverwaltung:</h5>
        <ul style="margin: 0; padding-left: 20px;">
          <li><strong>📊 Statistiken:</strong> Übersicht über alle Dateien, Größen und Metadaten</li>
          <li><strong>🗂️ Dateien anzeigen:</strong> Alle hochgeladenen Dateien mit Details</li>
          <li><strong>🗑️ Dateien löschen:</strong> Einzelne Dateien oder Masse-Operationen</li>
          <li><strong>🧹 Aufräumen:</strong> Automatisches Entfernen verwaister Dateien</li>
          <li><strong>🔍 Vorschau:</strong> Dateien direkt im Browser betrachten</li>
        </ul>
      </div>

      <div style="margin-top: 15px; padding: 12px; background: #fff3cd; border-radius: 6px; border-left: 4px solid #ffc107;">
        <p style="margin: 0; color: #856404;">
          <strong>💡 Tipp:</strong> Die Berechtigung für die Dateiverwaltung richtet sich nach den oben konfigurierten 
          <em>"Berechtigte Benutzer"</em> und <em>"Berechtigte Rollen"</em> Einstellungen.
        </p>
      </div>
    `,
    private: false
  });

  // Получаем роутер
  const router = getRouter()

  // Инициализируем статистики
  const statsRoutes = new StatsRoutes(peertubeHelpers, settingsManager);
  statsRoutes.registerRoutes(router);

  // Настраиваем Multer
  const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      const isImage = file.mimetype.startsWith('image/')
      const uploadPath = isImage ? imagesPath : documentsPath
      cb(null, uploadPath)
    },
    filename: function (req, file, cb) {
      const timestamp = Date.now()
      const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8')
      const ext = path.extname(originalName)
      const baseName = path.basename(originalName, ext)
      const safeBaseName = baseName.replace(/[^a-zA-Z0-9\-_äöüÄÖÜß]/g, '_')
      cb(null, `${timestamp}_${safeBaseName}${ext}`)
    }
  })

  const fileFilter = (req, file, cb) => {
    const allowedImageTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/x-icon',
      'image/vnd.microsoft.icon',
      'image/svg+xml'
    ]
    const allowedDocTypes = [
      'application/pdf',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]

    if (allowedImageTypes.includes(file.mimetype) || allowedDocTypes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Dateityp nicht erlaubt. Erlaubte Typen: JPG, PNG, GIF, WebP, ICO, SVG, PDF, TXT, DOC, DOCX'), false)
    }
  }


  const upload = multer({
    storage: storage,
    limits: {
      fileSize: 50 * 1024 * 1024 // 50MB Standard-Limit
    },
    fileFilter: fileFilter
  })

  // Middleware для проверки прав доступа
  async function checkUserAccess(req, res, next) {
    try {
      console.log('🔧 checkUserAccess called for:', req.method, req.path)

      let user = null

      try {
        user = await peertubeHelpers.user.getAuthUser(res)
        console.log('🔧 User from getAuthUser:', user ? `${user.username} (role: ${user.role})` : 'null')
      } catch (authError) {
        console.error('🔧 getAuthUser failed:', authError.message)
        return res.status(401).json({
          error: 'Authentifizierung erforderlich',
          debug: {
            authError: authError.message,
            method: req.method,
            path: req.path
          }
        })
      }

      if (!user) {
        console.log('🔧 No user found')
        return res.status(401).json({ error: 'Authentifizierung erforderlich' })
      }

      const settings = await settingsManager.getSettings([
        'enable-plugin',
        'allowed-users',
        'allowed-roles',
        'allowed-file-types',
        'max-file-size'
      ])

      if (!settings['enable-plugin']) {
        return res.status(403).json({ error: 'Plugin ist deaktiviert' })
      }

      // Проверяем роли
      const allowedRoles = settings['allowed-roles'] || 'all'
      const userRole = user.role // 0 = Admin, 1 = Moderator, 2 = User

      if (allowedRoles === 'admin' && userRole !== 0) {
        return res.status(403).json({ error: 'Nur für Administratoren' })
      }

      if (allowedRoles === 'admin-mod' && userRole > 1) {
        return res.status(403).json({ error: 'Nur für Administratoren und Moderatoren' })
      }

      // Проверяем конкретных пользователей
      const allowedUsers = settings['allowed-users']
      if (allowedUsers && allowedUsers.trim()) {
        const userList = allowedUsers.split(',').map(u => u.trim()).filter(u => u)
        if (userList.length > 0 && !userList.includes(user.username)) {
          return res.status(403).json({ error: 'Benutzer nicht berechtigt' })
        }
      }

      req.user = user
      req.settings = settings
      next()
    } catch (error) {
      console.error('🔧 Critical error in checkUserAccess:', error)
      res.status(500).json({
        error: 'Serverfehler bei Zugriffsprüfung',
        debug: {
          message: error.message,
          stack: error.stack
        }
      })
    }
  }

  // Middleware только для админов
  async function checkAdminAccess(req, res, next) {
    try {
      console.log('🔧 Admin access check')

      let user = null

      try {
        user = await peertubeHelpers.user.getAuthUser(res)
        console.log('🔧 Admin user from getAuthUser:', user)
      } catch (authError) {
        console.log('🔧 Admin getAuthUser failed:', authError.message)
        return res.status(401).json({
          error: 'Admin-Authentifizierung erforderlich',
          debug: { authError: authError.message }
        })
      }

      // Дополнительно проверяем конкретных пользователей из настроек
      const settings = await settingsManager.getSettings(['allowed-users', 'allowed-roles'])
      const allowedRoles = settings['allowed-roles'] || 'all'

      // Если пользователь не найден, пробуем альтернативные проверки
      if (!user) {
        return res.status(403).json({
          error: 'Nur für berechtigte Benutzer',
          debug: { hasUser: false }
        })
      }

      // Проверяем права доступа по ролям
      const userRole = user.role // 0 = Admin, 1 = Moderator, 2 = User

      if (allowedRoles === 'admin' && userRole !== 0) {
        return res.status(403).json({ error: 'Nur für Administratoren' })
      }

      if (allowedRoles === 'admin-mod' && userRole > 1) {
        return res.status(403).json({ error: 'Nur für Administratoren und Moderatoren' })
      }

      // Проверяем конкретных пользователей
      const allowedUsers = settings['allowed-users']
      if (allowedUsers && allowedUsers.trim()) {
        const userList = allowedUsers.split(',').map(u => u.trim()).filter(u => u)
        if (userList.length > 0 && !userList.includes(user.username)) {
          return res.status(403).json({ error: 'Benutzer nicht berechtigt für Admin-Funktionen' })
        }
      }

      console.log('🔧 Admin access granted for:', user.username)
      req.user = user
      next()
    } catch (error) {
      console.error('🔧 Error in admin access check:', error)
      res.status(500).json({
        error: 'Serverfehler bei Admin-Zugriffsprüfung',
        debug: error.message
      })
    }
  }

  // ВАЖНО: Регистрируем все роуты

  // API-Route для проверки доступа (для клиента)
  router.get('/check-access', checkUserAccess, async (req, res) => {
    try {
      res.json({
        allowed: true,
        user: {
          username: req.user.username,
          role: req.user.role,
          roleText: req.user.role === 0 ? 'Administrator' : req.user.role === 1 ? 'Moderator' : 'Benutzer'
        },
        settings: {
          allowedFileTypes: req.settings['allowed-file-types'] || 'all',
          maxFileSize: parseInt(req.settings['max-file-size'] || '10'),
          pagePath: req.settings['page-path'] || 'files/upload'
        }
      })
    } catch (error) {
      logger.error('Fehler bei check-access:', error)
      res.status(500).json({ error: 'Serverfehler' })
    }
  })

  // Upload-Route
  router.post('/upload', checkUserAccess, (req, res) => {
    const maxFileSize = parseInt(req.settings['max-file-size'] || '50') * 1024 * 1024

    console.log('🔧 Max file size configured:', maxFileSize, 'bytes (', req.settings['max-file-size'], 'MB)')

    const dynamicUpload = multer({
      storage: storage,
      limits: {
        fileSize: maxFileSize,
        fieldSize: maxFileSize // Добавляем лимит на поле формы
      },
      fileFilter: fileFilter
    }).single('file')

    dynamicUpload(req, res, async (err) => {
      try {
        if (err) {
          console.error('🔧 Multer error:', err)

          if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({
              error: `Datei zu groß. Maximum: ${req.settings['max-file-size']}MB`,
              maxSize: req.settings['max-file-size'],
              errorCode: 'FILE_TOO_LARGE'
            })
          }

          if (err.code === 'LIMIT_FIELD_VALUE') {
            return res.status(413).json({
              error: `Datei zu groß. Maximum: ${req.settings['max-file-size']}MB`,
              maxSize: req.settings['max-file-size'],
              errorCode: 'FIELD_TOO_LARGE'
            })
          }

          return res.status(400).json({
            error: err.message,
            errorCode: err.code || 'UPLOAD_ERROR'
          })
        }

        if (!req.file) {
          return res.status(400).json({ error: 'Keine Datei hochgeladen' })
        }

        console.log('🔧 File uploaded successfully:', req.file.filename, 'size:', req.file.size, 'bytes')

        const allowedTypes = req.settings['allowed-file-types'] || 'all'
        const isImage = req.file.mimetype.startsWith('image/')

        if (allowedTypes === 'images' && !isImage) {
          fs.unlinkSync(req.file.path)
          return res.status(400).json({ error: 'Nur Bilder sind erlaubt' })
        }

        if (allowedTypes === 'documents' && isImage) {
          fs.unlinkSync(req.file.path)
          return res.status(400).json({ error: 'Nur Dokumente sind erlaubt' })
        }

        const category = isImage ? 'images' : 'documents'
        const fileUrl = `/plugins/static-files/router/file/${category}/${req.file.filename}`

        const fileInfo = {
          filename: req.file.filename,
          originalname: req.file.originalname,
          uploadedBy: req.user?.username || 'Unbekannt',
          uploadDate: new Date().toISOString(),
          category: category,
          size: req.file.size,
          mimetype: req.file.mimetype,
          url: fileUrl
        }

        console.log('🧪 Сохраняемые метаданные файла:', fileInfo)

        try {
          // Используем файловое хранение вместо storageManager
          const saved = await saveFileMetadata(req.file.filename, fileInfo)

          if (saved) {
            // Проверяем, что данные сохранились
            const verification = await loadFileMetadata(req.file.filename)
            if (verification && verification.filename === req.file.filename) {
              console.log('🧪 Метаданные успешно сохранены и верифицированы (файловое хранение)')
            } else {
              console.error('🧪 Верификация метаданных не удалась (файловое хранение)')
            }
          } else {
            console.error('🧪 Не удалось сохранить метаданные (файловое хранение)')
          }

          // Дублируем в storageManager для совместимости
          try {
            await storageManager.storeData(`file_${req.file.filename}`, fileInfo)
            console.log('🧪 Метаданные также сохранены в storageManager')
          } catch (storageError) {
            console.error('🧪 Ошибка storageManager (не критично):', storageError.message)
          }

        } catch (error) {
          console.error('🧪 Критическая ошибка сохранения метаданных:', error)
        }

        res.json({
          success: true,
          message: 'Datei erfolgreich hochgeladen',
          file: fileInfo
        })

        logger.info(`Datei hochgeladen: ${req.file.originalname} (${req.file.size} bytes) von ${req.user.username}`)
      } catch (error) {
        logger.error('Fehler beim Datei-Upload:', error)
        res.status(500).json({ error: 'Fehler beim Hochladen der Datei' })
      }
    })
  })

  // Files-Route
  router.get('/files', checkUserAccess, async (req, res) => {
    try {
      const files = []

      async function loadFilesFromDir(dirPath, category) {
        if (!fs.existsSync(dirPath)) return

        const dirFiles = fs.readdirSync(dirPath)
        for (const filename of dirFiles) {
          const filePath = path.join(dirPath, filename)
          const stats = fs.statSync(filePath)

          let fileInfo = {}
          try {
            // Сначала пробуем файловое хранение
            fileInfo = await loadFileMetadata(filename)

            if (fileInfo && Object.keys(fileInfo).length > 0) {
              console.log(`🗃️ Загружены метаданные из файла для ${filename}`)
            } else {
              // Если файлового хранения нет, пробуем storageManager
              try {
                const storageKeys = [`file_${filename}`, `static-files_${filename}`]
                for (const key of storageKeys) {
                  const data = await storageManager.getData(key)
                  if (data && typeof data === 'object') {
                    fileInfo = data
                    console.log(`🧪 Загружены метаданные из storageManager для ${filename} по ключу ${key}`)
                    break
                  }
                }
              } catch (e) {
                console.log(`🧪 StorageManager недоступен для ${filename}`)
              }

              if (!fileInfo || Object.keys(fileInfo).length === 0) {
                console.log(`🗃️ Метаданные не найдены для ${filename}, используем данные файловой системы`)
              }
            }
          } catch (e) {
            console.error(`🗃️ Ошибка загрузки метаданных для ${filename}:`, e)
          }

          // Определяем автора файла
          let uploadedBy = 'Unbekannt'
          if (fileInfo.uploadedBy) {
            uploadedBy = fileInfo.uploadedBy
          } else if (fileInfo.username) {
            uploadedBy = fileInfo.username
          }

          files.push({
            filename: filename,
            category: category,
            size: stats.size,
            uploadDate: fileInfo.uploadDate || stats.birthtime.toISOString(),
            uploadedBy: uploadedBy,
            mimetype: fileInfo.mimetype || mime.lookup(filename) || 'application/octet-stream',
            url: `/plugins/static-files/router/file/${category}/${filename}`,
            hasMetadata: !!(fileInfo && Object.keys(fileInfo).length > 0)
          })
        }
      }

      await loadFilesFromDir(imagesPath, 'images')
      await loadFilesFromDir(documentsPath, 'documents')

      files.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate))

      res.json({
        files,
        total: files.length,
        totalSize: files.reduce((sum, file) => sum + file.size, 0)
      })
    } catch (error) {
      logger.error('Fehler beim Laden der Dateien:', error)
      res.status(500).json({ error: 'Fehler beim Laden der Dateien' })
    }
  })

  // Admin-Route для всех файлов (используем checkUserAccess вместо checkAdminAccess)
  router.get('/admin/files', checkUserAccess, async (req, res) => {
    try {
      const files = []

      async function loadFilesFromDir(dirPath, category) {
        if (!fs.existsSync(dirPath)) return

        const dirFiles = fs.readdirSync(dirPath)
        for (const filename of dirFiles) {
          const filePath = path.join(dirPath, filename)
          const stats = fs.statSync(filePath)

          let fileInfo = {}
          try {
            // Сначала пробуем файловое хранение
            fileInfo = await loadFileMetadata(filename)

            if (!fileInfo || Object.keys(fileInfo).length === 0) {
              // Если файлового хранения нет, пробуем storageManager
              try {
                fileInfo = await storageManager.getData(`file_${filename}`) || {}
              } catch (e) {
                console.log(`StorageManager недоступен для ${filename}`)
              }
            }
          } catch (e) {
            console.error(`Ошибка загрузки метаданных для ${filename}:`, e)
          }

          files.push({
            filename: filename,
            category: category,
            size: stats.size,
            uploadDate: fileInfo.uploadDate || stats.birthtime.toISOString(),
            uploadedBy: fileInfo.uploadedBy || 'Unbekannt',
            mimetype: fileInfo.mimetype || mime.lookup(filename) || 'application/octet-stream',
            url: `/plugins/static-files/router/file/${category}/${filename}`,
            hasMetadata: !!fileInfo.filename
          })
        }
      }

      await loadFilesFromDir(imagesPath, 'images')
      await loadFilesFromDir(documentsPath, 'documents')

      files.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate))

      res.json({
        files,
        stats: {
          total: files.length,
          totalSize: files.reduce((sum, file) => sum + file.size, 0),
          withMetadata: files.filter(f => f.hasMetadata).length,
          withoutMetadata: files.filter(f => !f.hasMetadata).length
        }
      })
    } catch (error) {
      logger.error('Fehler beim Laden der Admin-Dateien:', error)
      res.status(500).json({ error: 'Fehler beim Laden der Dateien' })
    }
  })

  // Cleanup-Route (используем checkUserAccess вместо checkAdminAccess)
  router.post('/admin/cleanup', checkUserAccess, async (req, res) => {
    try {
      let cleanedFiles = 0

      async function cleanupDir(dirPath, category) {
        if (!fs.existsSync(dirPath)) return

        const files = fs.readdirSync(dirPath)
        for (const filename of files) {
          try {
            let hasMetadata = false

            // Проверяем файловое хранение
            const fileMetadata = await loadFileMetadata(filename)
            if (fileMetadata && Object.keys(fileMetadata).length > 0) {
              hasMetadata = true
            } else {
              // Проверяем storageManager
              try {
                const storageMetadata = await storageManager.getData(`file_${filename}`)
                if (storageMetadata) {
                  hasMetadata = true
                }
              } catch (e) { }
            }

            if (!hasMetadata) {
              const filePath = path.join(dirPath, filename)
              const stats = fs.statSync(filePath)

              const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
              if (stats.birthtime < thirtyDaysAgo) {
                fs.unlinkSync(filePath)
                cleanedFiles++
                logger.info(`Cleanup: Verwaiste Datei gelöscht: ${filename}`)
              }
            }
          } catch (e) { }
        }
      }

      await cleanupDir(imagesPath, 'images')
      await cleanupDir(documentsPath, 'documents')

      res.json({
        success: true,
        message: `${cleanedFiles} verwaiste Dateien wurden aufgeräumt`,
        cleanedFiles
      })

      logger.info(`Admin Cleanup: ${cleanedFiles} Dateien aufgeräumt`)
    } catch (error) {
      logger.error('Fehler beim Cleanup:', error)
      res.status(500).json({ error: 'Fehler beim Cleanup' })
    }
  })

  // Delete-Route
  router.delete('/file/:category/:filename', checkUserAccess, async (req, res) => {
    try {
      const { category, filename } = req.params

      if (!['images', 'documents'].includes(category)) {
        return res.status(400).json({ error: 'Ungültige Kategorie' })
      }

      const filePath = path.join(uploadsPath, category, filename)

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Datei nicht gefunden' })
      }

      let fileInfo = {}
      try {
        // Сначала проверяем файловое хранение
        fileInfo = await loadFileMetadata(filename)

        if (!fileInfo || Object.keys(fileInfo).length === 0) {
          // Затем проверяем storageManager
          try {
            fileInfo = await storageManager.getData(`file_${filename}`) || {}
          } catch (e) { }
        }
      } catch (e) { }

      if (req.user.role !== 0 && fileInfo.uploadedBy && fileInfo.uploadedBy !== req.user.username) {
        return res.status(403).json({ error: 'Keine Berechtigung diese Datei zu löschen' })
      }

      fs.unlinkSync(filePath)

      // Удаляем метаданные из файлового хранения
      try {
        const metadataFile = path.join(metadataPath, `${filename}.json`)
        if (fs.existsSync(metadataFile)) {
          fs.unlinkSync(metadataFile)
        }
      } catch (e) { }

      // Удаляем из storageManager
      try {
        await storageManager.storeData(`file_${filename}`, null)
      } catch (e) { }

      res.json({
        success: true,
        message: 'Datei erfolgreich gelöscht'
      })

      logger.info(`Datei gelöscht: ${filename} von ${req.user.username}`)
    } catch (error) {
      logger.error('Fehler beim Löschen der Datei:', error)
      res.status(500).json({ error: 'Fehler beim Löschen der Datei' })
    }
  })

  // Route для отдачи файлов
  router.get('/file/:category/:filename', (req, res) => {
    try {
      const { category, filename } = req.params

      if (!['images', 'documents'].includes(category)) {
        return res.status(400).json({ error: 'Ungültige Kategorie' })
      }

      const filePath = path.join(uploadsPath, category, filename)

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Datei nicht gefunden' })
      }

      const stats = fs.statSync(filePath)
      const mimeType = mime.lookup(filePath) || 'application/octet-stream'

      res.setHeader('Content-Type', mimeType)
      res.setHeader('Content-Length', stats.size)
      res.setHeader('Cache-Control', 'public, max-age=31536000')
      res.setHeader('Last-Modified', stats.mtime.toUTCString())
      res.setHeader('ETag', `"${stats.mtime.getTime()}-${stats.size}"`)

      if (!req.query.inline) {
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
      }

      const fileStream = fs.createReadStream(filePath)
      fileStream.pipe(res)

      fileStream.on('error', (error) => {
        logger.error('Fehler beim Streamen der Datei:', error)
        if (!res.headersSent) {
          res.status(500).json({ error: 'Fehler beim Bereitstellen der Datei' })
        }
      })
    } catch (error) {
      logger.error('Fehler beim Bereitstellen der Datei:', error)
      res.status(500).json({ error: 'Fehler beim Bereitstellen der Datei' })
    }
  })

  logger.info('✅ Static Files Plugin erfolgreich registriert')
}

async function unregister() {
  console.log('Static Files Plugin wird deregistriert')
}

module.exports = {
  register,
  unregister
}