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
            <h1>📊 Instance Statistiken</h1>
            <p>Detaillierte Übersicht über Ihre PeerTube-Instanz</p>
          </div>

          <!-- Main Metrics -->
          <div id="main-metrics" class="metrics-grid">
            <div class="loading-container">
              <div class="loading-spinner"></div>
              <p>Lade Statistiken...</p>
            </div>
          </div>

          <!-- Video Statistics Section -->
          <div class="stats-section">
            <div class="stats-section-header">
              <h2 class="stats-section-title">📺 Video Statistiken</h2>
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
              <h2 class="stats-section-title">🔥 Activity heatmap</h2>
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
              <h2 class="stats-section-title">🏆 Top channels</h2>
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
            <h3 style="color: #fff; font-size: 1.1rem; margin-bottom: 1rem; font-weight: 600;">🎥 Top Videos (nach Zeit)</h3>
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
            <h3 style="color: #fff; font-size: 1.1rem; margin-bottom: 1rem; font-weight: 600;">🏆 Top 5 Most viewed videos</h3>
            <table class="stats-table">
              <thead>
                <tr>
                  <th>Video</th>
                  <th style="text-align: right;">Views</th>
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
          <div class="data-card-content" style="color: rgba(255,255,255,0.4);">No data</div>
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
      const regionName = item.region === 'Unknown' ? 'Unbekannt' : item.region;
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
          <span style="color: rgba(255,255,255,0.6); font-size: 0.85rem;">Weniger</span>
          ${[0, 0.25, 0.5, 0.75, 1].map(intensity => `
            <div style="width: 30px; height: 20px; background: ${this.getHeatmapColor(intensity)}; border-radius: 3px;"></div>
          `).join('')}
          <span style="color: rgba(255,255,255,0.6); font-size: 0.85rem;">Mehr</span>
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
            <div style="color: #fff; font-size: 1.1rem; font-weight: 600;">${rec.hour}:00 Uhr</div>
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
        <div class="metric-label">50th percentile (median)</div>
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
        Half of your viewers are watching. <strong style="color: #fff;">${formatTime(percentiles.p50)}</strong> oder länger.
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
            <th>Channel</th>
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
      container.innerHTML = '<p style="color: rgba(255,255,255,0.5); text-align: center; padding: 1rem;">No categories</p>';
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
            <th>Kategorie</th>
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
          📈 ${unit} over Time
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
            <td>${stat.hours.toFixed(1)} Stunden</td>
            <td>${stat.seconds.toLocaleString()} Sekunden</td>
          </tr>
        `;
      });
    } else if (metric === 'activeViewers') {
      window._statsData.activeViewers.forEach(stat => {
        tableRows += `
          <tr>
            <td><strong>${stat.date}</strong></td>
            <td colspan="2">${stat.uniqueViewers} Eindeutige Zuschauer</td>
          </tr>
        `;
      });
    }

    tableContainer.innerHTML = `
      <table class="stats-table">
        <thead>
          <tr>
            <th>Datum</th>
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
  module.exports = StatsPage;
} else {
  window.StatsPage = StatsPage;
}