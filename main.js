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

  logger.info('🚀 Static Files Plugin is being registered...')

  const dataDir = peertubeHelpers.plugin.getDataDirectoryPath()
  const metadataPath = path.join(dataDir, 'metadata')
  const uploadsPath = path.join(dataDir, 'uploads')
  const imagesPath = path.join(uploadsPath, 'images')
  const documentsPath = path.join(uploadsPath, 'documents')

  logger.info(`📂 Data directory: ${dataDir}`)

  try {
    if (!fs.existsSync(uploadsPath)) {
      fs.mkdirSync(uploadsPath, { recursive: true })
      logger.info('📁 Uploads directory created')
    }
    if (!fs.existsSync(imagesPath)) {
      fs.mkdirSync(imagesPath, { recursive: true })
      logger.info('📁 Images directory created')
    }
    if (!fs.existsSync(documentsPath)) {
      fs.mkdirSync(documentsPath, { recursive: true })
      logger.info('📁 Documents directory created')
    }
    if (!fs.existsSync(metadataPath)) {
      fs.mkdirSync(metadataPath, { recursive: true })
      logger.info('📁 Metadata directory created')
    }
  } catch (error) {
    logger.error('Error creating the directories:', error)
  }

  async function saveFileMetadata(filename, metadata) {
    try {
      const metadataFile = path.join(metadataPath, `${filename}.json`)
      fs.writeFileSync(metadataFile, JSON.stringify(metadata, null, 2))
      console.log(`🗃️ The metadata has been saved to a file.: ${metadataFile}`)
      return true
    } catch (error) {
      console.error(`🗃️ Error saving metadata for ${filename}:`, error)
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
      console.error(`🗃️ Error loading metadata for ${filename}:`, error)
      return null
    }
  }

  // Registering settings for the admin panel.
  registerSetting({
    name: 'enable-plugin',
    label: 'Activate plugin',
    type: 'input-checkbox',
    default: true,
    private: false,
    descriptionHTML: 'Enables or disables the entire plugin.'
  })

  registerSetting({
    name: 'page-path',
    label: 'Path to the upload page (without /)',
    type: 'input',
    default: 'files/upload',
    descriptionHTML: 'The page will be available at https://your-domain.com/p/{path} be available',
    private: false
  })

  registerSetting({
    name: 'allowed-users',
    label: 'Authorized users (separated by commas)',
    type: 'input-textarea',
    default: '',
    descriptionHTML: 'Usernames separated by commas. Leave blank = all logged-in users have access.',
    private: false
  })

  registerSetting({
    name: 'allowed-roles',
    label: 'Authorized roles',
    type: 'select',
    options: [
      { label: 'All registered users', value: 'all' },
      { label: 'Only administrators', value: 'admin' },
      { label: 'Administratoren und Moderatoren', value: 'admin-mod' }
    ],
    default: 'all',
    private: false
  })

  registerSetting({
    name: 'allowed-file-types',
    label: 'Allowed file types',
    type: 'select',
    options: [
      { label: 'All (images + documents)', value: 'all' },
      { label: 'Images only (JPG, PNG, GIF, WebP)', value: 'images' },
      { label: 'Only Documents (PDF, TXT, DOC, DOCX)', value: 'documents' }
    ],
    default: 'all',
    private: false
  })

  registerSetting({
    name: 'max-file-size',
    label: 'Maximum file size (MB)',
    type: 'input',
    default: '50',
    descriptionHTML: 'Maximum file size in megabytes',
    private: false
  })

  // SIMPLIFIED ADMIN SETUP - SIMPLY A LINK TO A SEPARATE PAGE
  registerSetting({
    name: 'admin-interface-link',
    label: 'File management',
    type: 'html',
    html: `
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px; text-align: center;">
        <h4 style="margin: 0 0 15px 0;">📁 File management</h4>
        <p style="margin: 0 0 20px 0;">Manage all uploaded files in a separate admin interface.</p>
        <a href="/p/files/admin" target="_blank" 
           style="background: white; color: #667eea; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
          🚀 For file management
        </a>
        <p style="margin: 15px 0 0 0; font-size: 0.9em; opacity: 0.9;">
          <strong>A notice:</strong> This page opens in a new tab and displays all files, statistics, and administrative options.
        </p>
      </div>
      
      <div style="margin-top: 20px; padding: 15px; background: #f8f9fa; border-radius: 6px; border-left: 4px solid #17a2b8;">
        <h5 style="color: #17a2b8; margin: 0 0 10px 0;">ℹ️ File management functions:</h5>
        <ul style="margin: 0; padding-left: 20px;">
          <li><strong>📊 Statistics:</strong> Overview of all files, sizes, and metadata</li>
          <li><strong>🗂️ Show files:</strong> All uploaded files with details</li>
          <li><strong>🗑️ Delete files:</strong> Individual files or batch operations</li>
          <li><strong>🧹 Clean up:</strong> Automatic removal of orphaned files</li>
          <li><strong>🔍 Preview:</strong> View files directly in your browser.</li>
        </ul>
      </div>

      <div style="margin-top: 15px; padding: 12px; background: #fff3cd; border-radius: 6px; border-left: 4px solid #ffc107;">
        <p style="margin: 0; color: #856404;">
          <strong>💡 Tip:</strong> The permissions for file management are determined by the settings configured above.
          <em>"Authorized users"</em> und <em>"Authorized roles"</em> Einstellungen.
        </p>
      </div>
    `,
    private: false
  });

  // We are receiving the router.
  const router = getRouter()

  // Initial statistics
  const statsRoutes = new StatsRoutes(peertubeHelpers, settingsManager);
  statsRoutes.registerRoutes(router);

  // Configuring Multer
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
      cb(new Error('File type not allowed. Allowed types: JPG, PNG, GIF, WebP, ICO, SVG, PDF, TXT, DOC, DOCX'), false)
    }
  }


  const upload = multer({
    storage: storage,
    limits: {
      fileSize: 50 * 1024 * 1024 // 50MB Standard-Limit
    },
    fileFilter: fileFilter
  })

  // Middleware for checking access rights
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
        return res.status(401).json({ error: 'Authentication required' })
      }

      const settings = await settingsManager.getSettings([
        'enable-plugin',
        'allowed-users',
        'allowed-roles',
        'allowed-file-types',
        'max-file-size'
      ])

      if (!settings['enable-plugin']) {
        return res.status(403).json({ error: 'The plugin is disabled.' })
      }

      // Checking roles
      const allowedRoles = settings['allowed-roles'] || 'all'
      const userRole = user.role // 0 = Admin, 1 = Moderator, 2 = User

      if (allowedRoles === 'admin' && userRole !== 0) {
        return res.status(403).json({ error: 'For administrators only' })
      }

      if (allowedRoles === 'admin-mod' && userRole > 1) {
        return res.status(403).json({ error: 'For administrators and moderators only.' })
      }

      // We are checking specific users.
      const allowedUsers = settings['allowed-users']
      if (allowedUsers && allowedUsers.trim()) {
        const userList = allowedUsers.split(',').map(u => u.trim()).filter(u => u)
        if (userList.length > 0 && !userList.includes(user.username)) {
          return res.status(403).json({ error: 'User not authorized' })
        }
      }

      req.user = user
      req.settings = settings
      next()
    } catch (error) {
      console.error('🔧 Critical error in checkUserAccess:', error)
      res.status(500).json({
        error: 'Server error during access verification.',
        debug: {
          message: error.message,
          stack: error.stack
        }
      })
    }
  }

  // Middleware for administrators only.
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
          error: 'Administrator authentication required',
          debug: { authError: authError.message }
        })
      }

      // We are also checking specific users from the settings.
      const settings = await settingsManager.getSettings(['allowed-users', 'allowed-roles'])
      const allowedRoles = settings['allowed-roles'] || 'all'

      // If the user is not found, we try alternative verification methods.
      if (!user) {
        return res.status(403).json({
          error: 'For authorized users only.',
          debug: { hasUser: false }
        })
      }

      // We are checking access rights based on roles.
      const userRole = user.role // 0 = Admin, 1 = Moderator, 2 = User

      if (allowedRoles === 'admin' && userRole !== 0) {
        return res.status(403).json({ error: 'For administrators only' })
      }

      if (allowedRoles === 'admin-mod' && userRole > 1) {
        return res.status(403).json({ error: 'For administrators and moderators only.' })
      }

      // We are checking specific users.
      const allowedUsers = settings['allowed-users']
      if (allowedUsers && allowedUsers.trim()) {
        const userList = allowedUsers.split(',').map(u => u.trim()).filter(u => u)
        if (userList.length > 0 && !userList.includes(user.username)) {
          return res.status(403).json({ error: 'User not authorized for admin functions.' })
        }
      }

      console.log('🔧 Admin access granted for:', user.username)
      req.user = user
      next()
    } catch (error) {
      console.error('🔧 Error in admin access check:', error)
      res.status(500).json({
        error: 'Server error during admin access check.',
        debug: error.message
      })
    }
  }

  // IMPORTANT: We are registering all routes.

  // API route for access verification (for the client)
  router.get('/check-access', checkUserAccess, async (req, res) => {
    try {
      res.json({
        allowed: true,
        user: {
          username: req.user.username,
          role: req.user.role,
          roleText: req.user.role === 0 ? 'Administrator' : req.user.role === 1 ? 'Moderator' : 'User'
        },
        settings: {
          allowedFileTypes: req.settings['allowed-file-types'] || 'all',
          maxFileSize: parseInt(req.settings['max-file-size'] || '10'),
          pagePath: req.settings['page-path'] || 'files/upload'
        }
      })
    } catch (error) {
      logger.error('Error during access check:', error)
      res.status(500).json({ error: 'Server error' })
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
        fieldSize: maxFileSize // Add a limit to the form field
      },
      fileFilter: fileFilter
    }).single('file')

    dynamicUpload(req, res, async (err) => {
      try {
        if (err) {
          console.error('🔧 Multer error:', err)

          if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({
              error: `File too large. Maximum: ${req.settings['max-file-size']}MB`,
              maxSize: req.settings['max-file-size'],
              errorCode: 'FILE_TOO_LARGE'
            })
          }

          if (err.code === 'LIMIT_FIELD_VALUE') {
            return res.status(413).json({
              error: `File/Field too large. Maximum: ${req.settings['max-file-size']}MB`,
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
          return res.status(400).json({ error: 'No file uploaded' })
        }

        console.log('🔧 File uploaded successfully:', req.file.filename, 'size:', req.file.size, 'bytes')

        const allowedTypes = req.settings['allowed-file-types'] || 'all'
        const isImage = req.file.mimetype.startsWith('image/')

        if (allowedTypes === 'images' && !isImage) {
          fs.unlinkSync(req.file.path)
          return res.status(400).json({ error: 'Only pictures are allowed.' })
        }

        if (allowedTypes === 'documents' && isImage) {
          fs.unlinkSync(req.file.path)
          return res.status(400).json({ error: 'Only documents are allowed.' })
        }

        const category = isImage ? 'images' : 'documents'
        const fileUrl = `/plugins/static-files/router/file/${category}/${req.file.filename}`

        const fileInfo = {
          filename: req.file.filename,
          originalname: req.file.originalname,
          uploadedBy: req.user?.username || 'Unknown',
          uploadDate: new Date().toISOString(),
          category: category,
          size: req.file.size,
          mimetype: req.file.mimetype,
          url: fileUrl
        }

        console.log('🧪 The following file metadata is preserved:', fileInfo)

        try {
          // We are using file storage instead of storageManager.
          const saved = await saveFileMetadata(req.file.filename, fileInfo)

          if (saved) {
            // We are checking that the data has been saved.
            const verification = await loadFileMetadata(req.file.filename)
            if (verification && verification.filename === req.file.filename) {
              console.log('🧪 Metadata has been successfully saved and verified (file storage).')
            } else {
              console.error('🧪 Metadata verification failed (file storage)')
            }
          } else {
            console.error('🧪 Failed to save metadata (file storage)')
          }

          // We are duplicating this in storageManager for compatibility.
          try {
            await storageManager.storeData(`file_${req.file.filename}`, fileInfo)
            console.log('🧪 The metadata is also stored in the storageManager.')
          } catch (storageError) {
            console.error('🧪 StorageManager error (not critical):', storageError.message)
          }

        } catch (error) {
          console.error('🧪 Critical error saving metadata:', error)
        }

        res.json({
          success: true,
          message: 'File uploaded successfully',
          file: fileInfo
        })

        logger.info(`File uploaded: ${req.file.originalname} (${req.file.size} bytes) from ${req.user.username}`)
      } catch (error) {
        logger.error('Error during file upload:', error)
        res.status(500).json({ error: 'Error uploading the file.' })
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
            // First, we'll try file-based storage.
            fileInfo = await loadFileMetadata(filename)

            if (fileInfo && Object.keys(fileInfo).length > 0) {
              console.log(`🗃️ Metadata has been loaded from the file for ${filename}`)
            } else {
              // Если файлового хранения нет, пробуем storageManager
              try {
                const storageKeys = [`file_${filename}`, `static-files_${filename}`]
                for (const key of storageKeys) {
                  const data = await storageManager.getData(key)
                  if (data && typeof data === 'object') {
                    fileInfo = data
                    console.log(`🧪 Metadata has been loaded from storageManager for ${filename} by key ${key}`)
                    break
                  }
                }
              } catch (e) {
                console.log(`🧪 StorageManager is not available for ${filename}`)
              }

              if (!fileInfo || Object.keys(fileInfo).length === 0) {
                console.log(`🗃️ No metadata found for ${filename}, We use file system data.`)
              }
            }
          } catch (e) {
            console.error(`🗃️ Error loading metadata for ${filename}:`, e)
          }

          // We are determining the author of the file.
          let uploadedBy = 'Unknown'
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
      logger.error('Error loading the files:', error)
      res.status(500).json({ error: 'Error loading the files.' })
    }
  })

  // Admin route for all files (using checkUserAccess instead of checkAdminAccess)
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
            // First, we'll try file-based storage.
            fileInfo = await loadFileMetadata(filename)

            if (!fileInfo || Object.keys(fileInfo).length === 0) {
              // If file storage is not available, we try storageManager.
              try {
                fileInfo = await storageManager.getData(`file_${filename}`) || {}
              } catch (e) {
                console.log(`StorageManager unavailable for ${filename}`)
              }
            }
          } catch (e) {
            console.error(`Error loading metadata for ${filename}:`, e)
          }

          files.push({
            filename: filename,
            category: category,
            size: stats.size,
            uploadDate: fileInfo.uploadDate || stats.birthtime.toISOString(),
            uploadedBy: fileInfo.uploadedBy || 'Unknown',
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
      logger.error('Error loading the admin files:', error)
      res.status(500).json({ error: 'Error loading the files.' })
    }
  })

  // Cleanup-Route (using checkUserAccess instead of checkAdminAccess)
  router.post('/admin/cleanup', checkUserAccess, async (req, res) => {
    try {
      let cleanedFiles = 0

      async function cleanupDir(dirPath, category) {
        if (!fs.existsSync(dirPath)) return

        const files = fs.readdirSync(dirPath)
        for (const filename of files) {
          try {
            let hasMetadata = false

            // We are checking the file storage.
            const fileMetadata = await loadFileMetadata(filename)
            if (fileMetadata && Object.keys(fileMetadata).length > 0) {
              hasMetadata = true
            } else {
              // Checking storageManager
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
                logger.info(`Cleanup: Orphaned file deleted: ${filename}`)
              }
            }
          } catch (e) { }
        }
      }

      await cleanupDir(imagesPath, 'images')
      await cleanupDir(documentsPath, 'documents')

      res.json({
        success: true,
        message: `${cleanedFiles} Orphaned files have been cleaned up.`,
        cleanedFiles
      })

      logger.info(`Admin Cleanup: ${cleanedFiles} Files cleaned up`)
    } catch (error) {
      logger.error('Error during cleanup:', error)
      res.status(500).json({ error: 'Error during cleanup' })
    }
  })

  // Delete-Route
  router.delete('/file/:category/:filename', checkUserAccess, async (req, res) => {
    try {
      const { category, filename } = req.params

      if (!['images', 'documents'].includes(category)) {
        return res.status(400).json({ error: 'Invalid Category' })
      }

      const filePath = path.join(uploadsPath, category, filename)

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found' })
      }

      let fileInfo = {}
      try {
        // First, we check the file storage.
        fileInfo = await loadFileMetadata(filename)

        if (!fileInfo || Object.keys(fileInfo).length === 0) {
          // Then we check the storageManager.
          try {
            fileInfo = await storageManager.getData(`file_${filename}`) || {}
          } catch (e) { }
        }
      } catch (e) { }

      if (req.user.role !== 0 && fileInfo.uploadedBy && fileInfo.uploadedBy !== req.user.username) {
        return res.status(403).json({ error: 'You do not have permission to delete this file.' })
      }

      fs.unlinkSync(filePath)

      // We are removing metadata from the file storage.
      try {
        const metadataFile = path.join(metadataPath, `${filename}.json`)
        if (fs.existsSync(metadataFile)) {
          fs.unlinkSync(metadataFile)
        }
      } catch (e) { }

      // Removing from storageManager
      try {
        await storageManager.storeData(`file_${filename}`, null)
      } catch (e) { }

      res.json({
        success: true,
        message: 'File successfully deleted'
      })

      logger.info(`File deleted: ${filename} from ${req.user.username}`)
    } catch (error) {
      logger.error('Error deleting the file:', error)
      res.status(500).json({ error: 'Error deleting the file.' })
    }
  })

  // Route for serving files
  router.get('/file/:category/:filename', (req, res) => {
    try {
      const { category, filename } = req.params

      if (!['images', 'documents'].includes(category)) {
        return res.status(400).json({ error: 'Invalid Category' })
      }

      const filePath = path.join(uploadsPath, category, filename)

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found' })
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
        logger.error('Error streaming the file:', error)
        if (!res.headersSent) {
          res.status(500).json({ error: 'Error deploying the file.' })
        }
      })
    } catch (error) {
      logger.error('Error while deploying the file:', error)
      res.status(500).json({ error: 'Error deploying the file.' })
    }
  })

  logger.info('✅ Static Files Plugin successfully registered')
}

async function unregister() {
  console.log('The Static Files plugin is being deregistered.')
}

module.exports = {
  register,
  unregister
}