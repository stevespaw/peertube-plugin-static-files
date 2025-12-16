const fs = require('fs')
const path = require('path')

console.log('🔨 Building PeerTube Static Files Plugin with Stats...')

if (!fs.existsSync('dist')) {
  fs.mkdirSync('dist', { recursive: true })
}

// Объединяем файлы в один
try {
  let combinedContent = ''

  // Читаем основной клиентский файл
  const mainClientFile = 'client/client-plugin.js'
  if (fs.existsSync(mainClientFile)) {
    combinedContent += fs.readFileSync(mainClientFile, 'utf8')
    console.log('✅ client-plugin.js загружен')
  } else {
    console.error('❌ client-plugin.js не найден!')
    process.exit(1)
  }

  // Если есть отдельный stats-page.js, добавляем его
  const statsPageFile = 'client/stats-page.js'
  if (fs.existsSync(statsPageFile)) {
    const statsContent = fs.readFileSync(statsPageFile, 'utf8')
    
    // Убираем export из stats-page.js если есть
    const cleanStatsContent = statsContent
      .replace(/export\s*\{[^}]*\}\s*;?\s*$/gm, '')
      .replace(/module\.exports\s*=\s*StatsPage\s*;?\s*/gm, '')
    
    combinedContent += '\n\n// === STATS PAGE INTEGRATION ===\n'
    combinedContent += cleanStatsContent
    console.log('✅ stats-page.js добавлен')
  }

  // Сохраняем объединенный файл
  fs.writeFileSync('dist/client-plugin.js', combinedContent)
  console.log('✅ Объединенный файл создан')
  
} catch (error) {
  console.error('❌ Ошибка при сборке:', error.message)
  process.exit(1)
}

console.log('🎉 Сборка завершена!')