const fs = require('fs')
const path = require('path')

console.log('🔨 Building PeerTube Static Files Plugin with Stats...')

if (!fs.existsSync('dist')) {
  fs.mkdirSync('dist', { recursive: true })
}

// Object file in one
try {
  let combinedContent = ''

  // Chinese* client file
  const mainClientFile = 'client/client-plugin.js'
  if (fs.existsSync(mainClientFile)) {
    combinedContent += fs.readFileSync(mainClientFile, 'utf8')
    console.log('✅ client-plugin.js loaded')
  } else {
    console.error('❌ client-plugin.js not found!')
    process.exit(1)
  }

  // If there is another stats-page.js, you can add it
  const statsPageFile = 'client/stats-page.js'
  if (fs.existsSync(statsPageFile)) {
    const statsContent = fs.readFileSync(statsPageFile, 'utf8')
    
    // Remove the `export` keyword from `stats-page.js` if it exists.
    const cleanStatsContent = statsContent
      .replace(/export\s*\{[^}]*\}\s*;?\s*$/gm, '')
      .replace(/module\.exports\s*=\s*StatsPage\s*;?\s*/gm, '')
    
    combinedContent += '\n\n// === STATS PAGE INTEGRATION ===\n'
    combinedContent += cleanStatsContent
    console.log('✅ stats-page.js has been added.')
  }

  // Сохраняем объединенный файл
  fs.writeFileSync('dist/client-plugin.js', combinedContent)
  console.log('✅ The combined file has been created.')
  
} catch (error) {
  console.error('❌ Error during compilation:', error.message)
  process.exit(1)
}

console.log('🎉 Assembly is complete!')