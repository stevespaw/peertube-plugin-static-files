const moment = require('moment');

class StatsRoutes {
  constructor(peertubeHelpers, settingsManager) {
    this.peertubeHelpers = peertubeHelpers;
    this.settingsManager = settingsManager;
  }

  async checkStatsAccess(req, res, next) {
    try {
      const user = await this.peertubeHelpers.user.getAuthUser(res);

      if (!user || (user.role !== 0 && user.role !== 1)) {
        return res.status(403).json({
          status: "failure",
          message: "You do not have permission to view statistics."
        });
      }

      req.user = user;
      next();
    } catch (error) {
      res.status(401).json({
        status: "failure",
        message: "Authentication required"
      });
    }
  }

  async getInstanceStats(req, res) {
    try {
      const { from, to, groupBy } = req.query;
      const fromDate = moment(from);
      const toDate = moment(to);
      const startOfMonth = moment().startOf('month');

      let usersCount = 0;
      let usersThisMonth = 0;
      let videosCount = 0;
      let videosThisMonth = 0;
      let openAbusesCount = 0;
      let videoViewsStats = [];

      // Users count
      let request = await this.peertubeHelpers.database.query(
        'SELECT COUNT(*) AS "count" FROM "user"',
        { type: "SELECT" }
      );

      if (request && request.length > 0) {
        usersCount = request[0].count;
      }

      // Users this month
      request = await this.peertubeHelpers.database.query(
        'SELECT COUNT(*) AS "count" FROM "user" WHERE "createdAt" > $dat',
        {
          type: "SELECT",
          bind: { dat: startOfMonth.format('YYYY-MM-DD HH:mm:ss') }
        }
      );

      if (request && request.length > 0) {
        usersThisMonth = request[0].count;
      }

      // Videos count
      request = await this.peertubeHelpers.database.query(
        'SELECT COUNT(*) AS "count" FROM "video" WHERE "remote" = $remote',
        {
          type: "SELECT",
          bind: { remote: false }
        }
      );

      if (request && request.length > 0) {
        videosCount = request[0].count;
      }

      // Videos this month
      request = await this.peertubeHelpers.database.query(
        'SELECT COUNT(*) AS "count" FROM "video" WHERE "createdAt" > $dat AND "remote" = $remote',
        {
          type: "SELECT",
          bind: {
            dat: startOfMonth.format('YYYY-MM-DD HH:mm:ss'),
            remote: false
          }
        }
      );

      if (request && request.length > 0) {
        videosThisMonth = request[0].count;
      }

      // Open abuse count
      request = await this.peertubeHelpers.database.query(
        'SELECT COUNT(*) AS "count" FROM "abuse" WHERE "state" = $state',
        {
          type: "SELECT",
          bind: { state: "1" }
        }
      );

      if (request && request.length > 0) {
        openAbusesCount = request[0].count;
      }

      // Storage stats
      let totalStorage = 0;
      try {
        request = await this.peertubeHelpers.database.query(
          'SELECT SUM("size") AS "totalSize" FROM "videoFile"',
          { type: "SELECT" }
        );
        if (request && request.length > 0 && request[0].totalSize) {
          totalStorage = parseInt(request[0].totalSize);
        }
      } catch (e) {
        this.peertubeHelpers.logger.error('Stats error (Storage):', e);
      }

      // Comments count (excluding deleted comments)
      let totalComments = 0;
      try {
        request = await this.peertubeHelpers.database.query(
          'SELECT COUNT(*) AS "count" FROM "videoComment" WHERE "videoId" IN (SELECT "id" FROM "video" WHERE "remote" = $remote) AND "deletedAt" IS NULL',
          {
            type: "SELECT",
            bind: { remote: false }
          }
        );
        if (request && request.length > 0) {
          totalComments = parseInt(request[0].count);
        }
      } catch (e) {
        this.peertubeHelpers.logger.error('Stats error (Comments):', e);
      }

      // Likes count - use aggregated values from video table (more reliable)
      // Also count from accountVideoRate table using 'type' field (enum: 'like' or 'dislike')
      let totalLikes = 0;
      try {
        // Method 1: Use aggregated likes from video table (fastest and most reliable)
        request = await this.peertubeHelpers.database.query(
          'SELECT SUM("likes") AS "totalLikes" FROM "video" WHERE "remote" = $remote',
          {
            type: "SELECT",
            bind: { remote: false }
          }
        );
        if (request && request.length > 0 && request[0].totalLikes) {
          totalLikes = parseInt(request[0].totalLikes) || 0;
        }

        // Method 2: Fallback - count from accountVideoRate table using 'type' field
        if (totalLikes === 0) {
          request = await this.peertubeHelpers.database.query(
            'SELECT COUNT(*) AS "count" FROM "accountVideoRate" WHERE "type" = $type AND "videoId" IN (SELECT "id" FROM "video" WHERE "remote" = $remote)',
            {
              type: "SELECT",
              bind: { type: 'like', remote: false }
            }
          );
          if (request && request.length > 0) {
            totalLikes = parseInt(request[0].count) || 0;
          }
        }
      } catch (e) {
        this.peertubeHelpers.logger.error('Stats error (Likes):', e);
      }

      // === NEW: DAU/WAU/MAU Metrics ===
      const now = moment();
      let dau = 0, wau = 0, mau = 0;

      try {
        // DAU (Daily Active Users) - last 24 hours
        request = await this.peertubeHelpers.database.query(
          `SELECT COUNT(DISTINCT uuid) as "count"
           FROM "localVideoViewer"
           WHERE "startDate" >= $threshold`,
          {
            type: "SELECT",
            bind: { threshold: now.clone().subtract(1, 'days').format('YYYY-MM-DD HH:mm:ss') }
          }
        );
        if (request && request.length > 0) {
          dau = parseInt(request[0].count) || 0;
        }
      } catch (e) {
        this.peertubeHelpers.logger.error('Stats error (DAU):', e);
      }

      try {
        // WAU (Weekly Active Users) - last 7 days
        request = await this.peertubeHelpers.database.query(
          `SELECT COUNT(DISTINCT uuid) as "count"
           FROM "localVideoViewer"
           WHERE "startDate" >= $threshold`,
          {
            type: "SELECT",
            bind: { threshold: now.clone().subtract(7, 'days').format('YYYY-MM-DD HH:mm:ss') }
          }
        );
        if (request && request.length > 0) {
          wau = parseInt(request[0].count) || 0;
        }
      } catch (e) {
        this.peertubeHelpers.logger.error('Stats error (WAU):', e);
      }

      try {
        // MAU (Monthly Active Users) - last 30 days
        request = await this.peertubeHelpers.database.query(
          `SELECT COUNT(DISTINCT uuid) as "count"
           FROM "localVideoViewer"
           WHERE "startDate" >= $threshold`,
          {
            type: "SELECT",
            bind: { threshold: now.clone().subtract(30, 'days').format('YYYY-MM-DD HH:mm:ss') }
          }
        );
        if (request && request.length > 0) {
          mau = parseInt(request[0].count) || 0;
        }
      } catch (e) {
        this.peertubeHelpers.logger.error('Stats error (MAU):', e);
      }

      // === NEW: Retention Metrics ===
      let avgWatchTimeSeconds = 0;
      let medianWatchTimeSeconds = 0;

      // Use default date range if not provided (last 30 days)
      const retentionStartDate = from ? fromDate : moment().subtract(30, 'days');
      const retentionEndDate = to ? toDate : moment();

      try {
        // Average watch time per viewer session
        // Use startDate only for filtering, as endDate might be NULL for active sessions
        request = await this.peertubeHelpers.database.query(
          `SELECT AVG("watchTime") as "avgWatchTime"
           FROM "localVideoViewer"
           WHERE "startDate" >= $start AND "startDate" <= $end AND "watchTime" IS NOT NULL AND "watchTime" > 0`,
          {
            type: "SELECT",
            bind: {
              start: retentionStartDate.format('YYYY-MM-DD HH:mm:ss'),
              end: retentionEndDate.format('YYYY-MM-DD HH:mm:ss')
            }
          }
        );
        if (request && request.length > 0 && request[0].avgWatchTime) {
          avgWatchTimeSeconds = Math.round(parseFloat(request[0].avgWatchTime));
        }
      } catch (e) {
        this.peertubeHelpers.logger.error('Stats error (Avg Watch Time):', e);
      }

      try {
        // Median watch time (50th percentile)
        // Use startDate only for filtering, as endDate might be NULL for active sessions
        request = await this.peertubeHelpers.database.query(
          `SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY "watchTime") as "medianWatchTime"
           FROM "localVideoViewer"
           WHERE "startDate" >= $start AND "startDate" <= $end AND "watchTime" IS NOT NULL AND "watchTime" > 0`,
          {
            type: "SELECT",
            bind: {
              start: retentionStartDate.format('YYYY-MM-DD HH:mm:ss'),
              end: retentionEndDate.format('YYYY-MM-DD HH:mm:ss')
            }
          }
        );
        if (request && request.length > 0 && request[0].medianWatchTime) {
          medianWatchTimeSeconds = Math.round(parseFloat(request[0].medianWatchTime));
        }
      } catch (e) {
        this.peertubeHelpers.logger.error('Stats error (Median Watch Time):', e);
      }

      // Top Videos (Most Viewed)
      let topVideos = [];
      try {
        request = await this.peertubeHelpers.database.query(
          'SELECT "name", "views", "duration", "uuid" FROM "video" WHERE "remote" = $remote ORDER BY "views" DESC LIMIT 5',
          {
            type: "SELECT",
            bind: { remote: false }
          }
        );
        if (request && request.length > 0) {
          topVideos = request;
        }
      } catch (e) {
        this.peertubeHelpers.logger.error('Stats error (Top Videos):', e);
      }

      // Watch Time Stats
      // Default to last 30 days if not specified
      const startDate = from ? moment(from) : moment().subtract(30, 'days');
      const endDate = to ? moment(to) : moment();

      // 1. Total Watch Time
      let totalWatchTimeSeconds = 0;
      let isEstimated = false;

      try {
        // Try to get real watch time from localVideoViewer
        request = await this.peertubeHelpers.database.query(
          `SELECT SUM(lvv."watchTime") as "totalDuration" 
           FROM "localVideoViewer" lvv
           JOIN "video" v ON v."id" = lvv."videoId"
           WHERE lvv."startDate" >= $start AND lvv."endDate" <= $end AND v."remote" = $remote`,
          {
            type: "SELECT",
            bind: {
              start: startDate.format('YYYY-MM-DD HH:mm:ss'),
              end: endDate.format('YYYY-MM-DD HH:mm:ss'),
              remote: false
            }
          }
        );

        if (request && request.length > 0 && request[0].totalDuration) {
          totalWatchTimeSeconds = parseInt(request[0].totalDuration);
        } else {
          // If no data in localVideoViewer, it might be empty or not used. 
          // We can check if we should fallback. 
          // But if the query succeeded and returned 0, it means 0 watch time.
          // However, to be safe against "missing table" errors which are caught below, we proceed.
        }
      } catch (e) {
        this.peertubeHelpers.logger.error('Stats error (Real Watch Time failed, falling back):', e);
        isEstimated = true;

        // Fallback to approximation: views * duration
        try {
          request = await this.peertubeHelpers.database.query(
            `SELECT SUM(v."duration" * vv."views") as "totalDuration" 
            FROM "videoView" vv
            JOIN "video" v ON v."id" = vv."videoId"
            WHERE vv."startDate" >= $start AND vv."endDate" <= $end AND v."remote" = $remote`,
            {
              type: "SELECT",
              bind: {
                start: startDate.format('YYYY-MM-DD HH:mm:ss'),
                end: endDate.format('YYYY-MM-DD HH:mm:ss'),
                remote: false
              }
            }
          );

          if (request && request.length > 0 && request[0].totalDuration) {
            totalWatchTimeSeconds = parseInt(request[0].totalDuration);
          }
        } catch (e2) {
          this.peertubeHelpers.logger.error('Stats error (Fallback Watch Time):', e2);
        }
      }
      const totalWatchTimeHours = Math.round(totalWatchTimeSeconds / 3600);

      // 2. Watch Time by Channel
      let watchTimeByChannel = [];
      try {
        if (!isEstimated) {
          // Real stats
          request = await this.peertubeHelpers.database.query(
            `SELECT vc."name" as "channelName", SUM(lvv."watchTime") as "totalDuration"
                FROM "localVideoViewer" lvv
                JOIN "video" v ON v."id" = lvv."videoId"
                JOIN "videoChannel" vc ON vc."id" = v."channelId"
                WHERE lvv."startDate" >= $start AND lvv."endDate" <= $end AND v."remote" = $remote
                GROUP BY vc."name"
                ORDER BY "totalDuration" DESC
                LIMIT 5`,
            {
              type: "SELECT",
              bind: {
                start: startDate.format('YYYY-MM-DD HH:mm:ss'),
                end: endDate.format('YYYY-MM-DD HH:mm:ss'),
                remote: false
              }
            }
          );
        } else {
          // Fallback stats
          request = await this.peertubeHelpers.database.query(
            `SELECT vc."name" as "channelName", SUM(v."duration" * vv."views") as "totalDuration"
                FROM "videoView" vv
                JOIN "video" v ON v."id" = vv."videoId"
                JOIN "videoChannel" vc ON vc."id" = v."channelId"
                WHERE vv."startDate" >= $start AND vv."endDate" <= $end AND v."remote" = $remote
                GROUP BY vc."name"
                ORDER BY "totalDuration" DESC
                LIMIT 5`,
            {
              type: "SELECT",
              bind: {
                start: startDate.format('YYYY-MM-DD HH:mm:ss'),
                end: endDate.format('YYYY-MM-DD HH:mm:ss'),
                remote: false
              }
            }
          );
        }

        if (request && request.length > 0) {
          watchTimeByChannel = request.map(r => ({
            name: r.channelName,
            hours: Math.round(parseInt(r.totalDuration) / 3600)
          }));
        }
      } catch (e) {
        this.peertubeHelpers.logger.error('Stats error (Watch Time Channel):', e);
      }

      // 3. Watch Time by Video
      let watchTimeByVideo = [];
      try {
        if (!isEstimated) {
          // Real stats
          request = await this.peertubeHelpers.database.query(
            `SELECT v."name" as "videoName", v."uuid", SUM(lvv."watchTime") as "totalDuration"
                FROM "localVideoViewer" lvv
                JOIN "video" v ON v."id" = lvv."videoId"
                WHERE lvv."startDate" >= $start AND lvv."endDate" <= $end AND v."remote" = $remote
                GROUP BY v."name", v."uuid"
                ORDER BY "totalDuration" DESC
                LIMIT 5`,
            {
              type: "SELECT",
              bind: {
                start: startDate.format('YYYY-MM-DD HH:mm:ss'),
                end: endDate.format('YYYY-MM-DD HH:mm:ss'),
                remote: false
              }
            }
          );
        } else {
          // Fallback stats
          request = await this.peertubeHelpers.database.query(
            `SELECT v."name" as "videoName", v."uuid", SUM(v."duration" * vv."views") as "totalDuration"
                FROM "videoView" vv
                JOIN "video" v ON v."id" = vv."videoId"
                WHERE vv."startDate" >= $start AND vv."endDate" <= $end AND v."remote" = $remote
                GROUP BY v."name", v."uuid"
                ORDER BY "totalDuration" DESC
                LIMIT 5`,
            {
              type: "SELECT",
              bind: {
                start: startDate.format('YYYY-MM-DD HH:mm:ss'),
                end: endDate.format('YYYY-MM-DD HH:mm:ss'),
                remote: false
              }
            }
          );
        }

        if (request && request.length > 0) {
          watchTimeByVideo = request.map(r => ({
            name: r.videoName,
            uuid: r.uuid,
            hours: Math.round(parseInt(r.totalDuration) / 3600)
          }));
        }
      } catch (e) {
        this.peertubeHelpers.logger.error('Stats error (Watch Time Video):', e);
      }

      // 4. Unique Viewers
      let uniqueViewers = 0;
      try {
        request = await this.peertubeHelpers.database.query(
          `SELECT COUNT(DISTINCT lvv."uuid") as "count"
           FROM "localVideoViewer" lvv
           JOIN "video" v ON v."id" = lvv."videoId"
           WHERE lvv."startDate" >= $start AND lvv."endDate" <= $end AND v."remote" = $remote`,
          {
            type: "SELECT",
            bind: {
              start: startDate.format('YYYY-MM-DD HH:mm:ss'),
              end: endDate.format('YYYY-MM-DD HH:mm:ss'),
              remote: false
            }
          }
        );
        if (request && request.length > 0) {
          uniqueViewers = parseInt(request[0].count);
        }
      } catch (e) {
        this.peertubeHelpers.logger.error('Stats error (Unique Viewers):', e);
      }

      // 5. Viewers by Country
      let viewersByCountry = [];
      try {
        request = await this.peertubeHelpers.database.query(
          `SELECT lvv."country", COUNT(*) as "views", SUM(lvv."watchTime") as "watchTime"
           FROM "localVideoViewer" lvv
           JOIN "video" v ON v."id" = lvv."videoId"
           WHERE lvv."startDate" >= $start AND lvv."endDate" <= $end AND v."remote" = $remote
           GROUP BY lvv."country"
           ORDER BY "views" DESC
           LIMIT 10`,
          {
            type: "SELECT",
            bind: {
              start: startDate.format('YYYY-MM-DD HH:mm:ss'),
              end: endDate.format('YYYY-MM-DD HH:mm:ss'),
              remote: false
            }
          }
        );
        if (request) viewersByCountry = request;
      } catch (e) {
        this.peertubeHelpers.logger.error('Stats error (Viewers by Country):', e);
      }

      // 6. Viewers by Device
      let viewersByDevice = [];
      try {
        request = await this.peertubeHelpers.database.query(
          `SELECT lvv."device", COUNT(*) as "views"
           FROM "localVideoViewer" lvv
           JOIN "video" v ON v."id" = lvv."videoId"
           WHERE lvv."startDate" >= $start AND lvv."endDate" <= $end AND v."remote" = $remote
           GROUP BY lvv."device"
           ORDER BY "views" DESC`,
          {
            type: "SELECT",
            bind: {
              start: startDate.format('YYYY-MM-DD HH:mm:ss'),
              end: endDate.format('YYYY-MM-DD HH:mm:ss'),
              remote: false
            }
          }
        );
        if (request) viewersByDevice = request;
      } catch (e) {
        this.peertubeHelpers.logger.error('Stats error (Viewers by Device):', e);
      }

      // 7. Viewers by OS
      let viewersByOS = [];
      try {
        request = await this.peertubeHelpers.database.query(
          `SELECT lvv."operatingSystem", COUNT(*) as "views"
           FROM "localVideoViewer" lvv
           JOIN "video" v ON v."id" = lvv."videoId"
           WHERE lvv."startDate" >= $start AND lvv."endDate" <= $end AND v."remote" = $remote
           GROUP BY lvv."operatingSystem"
           ORDER BY "views" DESC`,
          {
            type: "SELECT",
            bind: {
              start: startDate.format('YYYY-MM-DD HH:mm:ss'),
              end: endDate.format('YYYY-MM-DD HH:mm:ss'),
              remote: false
            }
          }
        );
        if (request) viewersByOS = request;
      } catch (e) {
        this.peertubeHelpers.logger.error('Stats error (Viewers by OS):', e);
      }

      // 8. Viewers by Client (Browser)
      let viewersByClient = [];
      try {
        request = await this.peertubeHelpers.database.query(
          `SELECT lvv."client", COUNT(*) as "views"
           FROM "localVideoViewer" lvv
           JOIN "video" v ON v."id" = lvv."videoId"
           WHERE lvv."startDate" >= $start AND lvv."endDate" <= $end AND v."remote" = $remote
           GROUP BY lvv."client"
           ORDER BY "views" DESC`,
          {
            type: "SELECT",
            bind: {
              start: startDate.format('YYYY-MM-DD HH:mm:ss'),
              end: endDate.format('YYYY-MM-DD HH:mm:ss'),
              remote: false
            }
          }
        );
        if (request) viewersByClient = request;
      } catch (e) {
        this.peertubeHelpers.logger.error('Stats error (Viewers by Client):', e);
      }

      // 9. Viewers by Region (subdivisionName + country)
      let viewersByRegion = [];
      try {
        request = await this.peertubeHelpers.database.query(
          `SELECT 
             COALESCE(lvv."subdivisionName", 'Unknown') as "region",
             COALESCE(lvv."country", 'Unknown') as "country",
             COUNT(*) as "views",
             COUNT(DISTINCT lvv.uuid) as "uniqueViewers",
             SUM(lvv."watchTime") as "watchSeconds"
           FROM "localVideoViewer" lvv
           JOIN "video" v ON v."id" = lvv."videoId"
           WHERE lvv."startDate" >= $start AND lvv."startDate" <= $end AND v."remote" = $remote
           GROUP BY COALESCE(lvv."subdivisionName", 'Unknown'),
                    COALESCE(lvv."country", 'Unknown')
           ORDER BY "views" DESC
           LIMIT 20`,
          {
            type: "SELECT",
            bind: {
              start: startDate.format('YYYY-MM-DD HH:mm:ss'),
              end: endDate.format('YYYY-MM-DD HH:mm:ss'),
              remote: false
            }
          }
        );
        if (request) viewersByRegion = request;
      } catch (e) {
        this.peertubeHelpers.logger.error('Stats error (Viewers by Region):', e);
      }


      // === Phase 2: Activity Heatmap ===
      let activityHeatmap = [];
      try {
        request = await this.peertubeHelpers.database.query(
          `SELECT 
             EXTRACT(DOW FROM lvv."startDate") as "dayOfWeek",
             EXTRACT(HOUR FROM lvv."startDate") as "hourOfDay",
             COUNT(*) as "views",
             SUM(lvv."watchTime") as "watchSeconds"
           FROM "localVideoViewer" lvv
           JOIN "video" v ON v."id" = lvv."videoId"
           WHERE lvv."startDate" >= $start 
             AND lvv."startDate" <= $end 
             AND v."remote" = $remote
           GROUP BY EXTRACT(DOW FROM lvv."startDate"),
                    EXTRACT(HOUR FROM lvv."startDate")
           ORDER BY "dayOfWeek", "hourOfDay"`,
          {
            type: "SELECT",
            bind: {
              start: startDate.format('YYYY-MM-DD HH:mm:ss'),
              end: endDate.format('YYYY-MM-DD HH:mm:ss'),
              remote: false
            }
          }
        );
        if (request) {
          activityHeatmap = request.map(r => ({
            dayOfWeek: parseInt(r.dayOfWeek),
            hourOfDay: parseInt(r.hourOfDay),
            views: parseInt(r.views) || 0,
            watchSeconds: parseInt(r.watchSeconds) || 0
          }));
        }
      } catch (e) {
        this.peertubeHelpers.logger.error('Stats error (Activity Heatmap):', e);
      }

      // === Phase 2: Watch Time Distribution (Percentiles) ===
      let watchTimePercentiles = {};
      try {
        request = await this.peertubeHelpers.database.query(
          `SELECT 
             percentile_cont(0.25) WITHIN GROUP (ORDER BY "watchTime") as "p25",
             percentile_cont(0.50) WITHIN GROUP (ORDER BY "watchTime") as "p50",
             percentile_cont(0.75) WITHIN GROUP (ORDER BY "watchTime") as "p75",
             percentile_cont(0.90) WITHIN GROUP (ORDER BY "watchTime") as "p90",
             percentile_cont(0.95) WITHIN GROUP (ORDER BY "watchTime") as "p95"
           FROM "localVideoViewer"
           WHERE "startDate" >= $start AND "startDate" <= $end`,
          {
            type: "SELECT",
            bind: {
              start: startDate.format('YYYY-MM-DD HH:mm:ss'),
              end: endDate.format('YYYY-MM-DD HH:mm:ss')
            }
          }
        );
        if (request && request.length > 0) {
          watchTimePercentiles = {
            p25: Math.round(parseFloat(request[0].p25) || 0),
            p50: Math.round(parseFloat(request[0].p50) || 0),
            p75: Math.round(parseFloat(request[0].p75) || 0),
            p90: Math.round(parseFloat(request[0].p90) || 0),
            p95: Math.round(parseFloat(request[0].p95) || 0)
          };
        }
      } catch (e) {
        this.peertubeHelpers.logger.error('Stats error (Watch Time Percentiles):', e);
      }


      // === Phase 3: Top Channels Performance ===
      let topChannels = [];
      try {
        // Get channels with actual view event counts and watch time
        request = await this.peertubeHelpers.database.query(
          `SELECT 
             vc.id,
             vc.name,
             COUNT(DISTINCT v.id) as "videoCount",
             COUNT(lvv.id) as "totalViews",
             COALESCE(SUM(lvv."watchTime") / 3600.0, 0) as "watchHours"
           FROM "videoChannel" vc
           LEFT JOIN "video" v ON v."channelId" = vc.id AND v."remote" = $remote
           LEFT JOIN "localVideoViewer" lvv ON lvv."videoId" = v.id
             AND lvv."startDate" >= $start AND lvv."startDate" <= $end
           GROUP BY vc.id, vc.name
           HAVING COUNT(DISTINCT v.id) > 0
           ORDER BY "totalViews" DESC
           LIMIT 10`,
          {
            type: "SELECT",
            bind: {
              start: startDate.format('YYYY-MM-DD HH:mm:ss'),
              end: endDate.format('YYYY-MM-DD HH:mm:ss'),
              remote: false
            }
          }
        );
        if (request) {
          topChannels = request.map(r => ({
            id: r.id,
            name: r.name,
            videoCount: parseInt(r.videoCount) || 0,
            totalViews: parseInt(r.totalViews) || 0,
            watchHours: Math.round(parseFloat(r.watchHours) * 10) / 10
          }));
        }
      } catch (e) {
        this.peertubeHelpers.logger.error('Stats error (Top Channels):', e);
      }

      // === Phase 3: Category Statistics ===
      let topCategories = [];
      try {
        request = await this.peertubeHelpers.database.query(
          `SELECT 
             v.category,
             COUNT(DISTINCT v.id) as "videoCount",
             COUNT(lvv.id) as "totalViews",
             COALESCE(SUM(lvv."watchTime") / 3600.0, 0) as "watchHours"
           FROM "video" v
           LEFT JOIN "localVideoViewer" lvv ON lvv."videoId" = v.id
             AND lvv."startDate" >= $start AND lvv."startDate" <= $end
           WHERE v."remote" = $remote AND v.category IS NOT NULL
           GROUP BY v.category
           ORDER BY "totalViews" DESC
           LIMIT 10`,
          {
            type: "SELECT",
            bind: {
              start: startDate.format('YYYY-MM-DD HH:mm:ss'),
              end: endDate.format('YYYY-MM-DD HH:mm:ss'),
              remote: false
            }
          }
        );
        if (request) {
          topCategories = request.map(r => ({
            category: r.category,
            videoCount: parseInt(r.videoCount) || 0,
            totalViews: parseInt(r.totalViews) || 0,
            watchHours: Math.round(parseFloat(r.watchHours) * 10) / 10
          }));
        }
      } catch (e) {
        this.peertubeHelpers.logger.error('Stats error (Categories):', e);
      }

      // === Phase 3: Fast Growing Videos (7-day comparison) ===
      let fastGrowingVideos = [];
      try {
        const sevenDaysAgo = moment(endDate).subtract(7, 'days');
        request = await this.peertubeHelpers.database.query(
          `WITH recent_views AS (
             SELECT 
               v.id,
               v.uuid,
               v.name,
               COALESCE(SUM(CASE WHEN vv."startDate" >= $recent THEN vv.views ELSE 0 END), 0) as recent_views,
               COALESCE(SUM(CASE WHEN vv."startDate" < $recent THEN vv.views ELSE 0 END), 0) as old_views
             FROM "video" v
             LEFT JOIN "videoView" vv ON vv."videoId" = v.id
               AND vv."startDate" >= $start AND vv."endDate" <= $end
             WHERE v."remote" = $remote
             GROUP BY v.id, v.uuid, v.name
           )
           SELECT 
             id,
             uuid,
             name,
             recent_views,
             old_views,
             (recent_views - old_views) as growth
           FROM recent_views
           WHERE recent_views > 0
           ORDER BY growth DESC
           LIMIT 10`,
          {
            type: "SELECT",
            bind: {
              start: startDate.format('YYYY-MM-DD HH:mm:ss'),
              end: endDate.format('YYYY-MM-DD HH:mm:ss'),
              recent: sevenDaysAgo.format('YYYY-MM-DD HH:mm:ss'),
              remote: false
            }
          }
        );
        if (request) {
          fastGrowingVideos = request.map(r => ({
            uuid: r.uuid,
            name: r.name,
            recentViews: parseInt(r.recent_views) || 0,
            oldViews: parseInt(r.old_views) || 0,
            growth: parseInt(r.growth) || 0
          }));
        }
      } catch (e) {
        this.peertubeHelpers.logger.error('Stats error (Fast Growing Videos):', e);
      }


      // Video views stats (Dynamics)
      request = await this.peertubeHelpers.database.query(
        'SELECT "videoId", "views", "startDate", "endDate" FROM "videoView" WHERE "startDate" >= $start AND "endDate" <= $end AND "videoId" IN (SELECT "id" FROM "video" WHERE "remote" = $remote)',
        {
          type: "SELECT",
          bind: {
            start: startDate.format('YYYY-MM-DD HH:mm:ss'),
            end: endDate.format('YYYY-MM-DD HH:mm:ss'),
            remote: false
          }
        }
      );

      if (request && request.length > 0) {
        videoViewsStats = this.groupVideoViewsStats(request, groupBy || 'day');
      }

      // === NEW: Time Series for Watch Time ===
      let watchTimeTimeSeries = [];
      try {
        request = await this.peertubeHelpers.database.query(
          `SELECT 
             date(lvv."startDate") AS "date",
             SUM(lvv."watchTime") AS "totalSeconds"
           FROM "localVideoViewer" lvv
           JOIN "video" v ON v."id" = lvv."videoId"
           WHERE lvv."startDate" >= $start 
             AND lvv."startDate" <= $end 
             AND v."remote" = $remote
           GROUP BY date(lvv."startDate")
           ORDER BY "date"`,
          {
            type: "SELECT",
            bind: {
              start: startDate.format('YYYY-MM-DD HH:mm:ss'),
              end: endDate.format('YYYY-MM-DD HH:mm:ss'),
              remote: false
            }
          }
        );
        if (request) {
          watchTimeTimeSeries = request.map(r => ({
            date: moment(r.date).format('YYYY-MM-DD'),
            seconds: parseInt(r.totalSeconds) || 0,
            hours: Math.round(parseInt(r.totalSeconds) / 3600 * 10) / 10
          }));
        }
      } catch (e) {
        this.peertubeHelpers.logger.error('Stats error (Watch Time Time Series):', e);
      }

      // === NEW: Time Series for Active Viewers ===
      let activeViewersTimeSeries = [];
      try {
        request = await this.peertubeHelpers.database.query(
          `SELECT 
             date(lvv."startDate") AS "date",
             COUNT(DISTINCT lvv.uuid) AS "uniqueViewers"
           FROM "localVideoViewer" lvv
           JOIN "video" v ON v."id" = lvv."videoId"
           WHERE lvv."startDate" >= $start 
             AND lvv."startDate" <= $end 
             AND v."remote" = $remote
           GROUP BY date(lvv."startDate")
           ORDER BY "date"`,
          {
            type: "SELECT",
            bind: {
              start: startDate.format('YYYY-MM-DD HH:mm:ss'),
              end: endDate.format('YYYY-MM-DD HH:mm:ss'),
              remote: false
            }
          }
        );
        if (request) {
          activeViewersTimeSeries = request.map(r => ({
            date: moment(r.date).format('YYYY-MM-DD'),
            uniqueViewers: parseInt(r.uniqueViewers) || 0
          }));
        }
      } catch (e) {
        this.peertubeHelpers.logger.error('Stats error (Active Viewers Time Series):', e);
      }

      res.json({
        status: "success",
        data: {
          usersCount,
          usersThisMonth,
          videosCount,
          videosThisMonth,
          openAbusesCount,
          totalStorage,
          totalComments,
          totalLikes,
          topVideos,
          totalWatchTimeHours,
          watchTimeByChannel,
          watchTimeByVideo,
          videoViewsStats,
          isEstimated,
          uniqueViewers,
          viewersByCountry,
          viewersByDevice,
          viewersByOS,
          viewersByClient,
          viewersByRegion,
          // NEW: Active audience metrics
          dau,
          wau,
          mau,
          // NEW: Retention metrics
          avgWatchTimeSeconds,
          medianWatchTimeSeconds,
          // NEW: Time series
          watchTimeTimeSeries,
          activeViewersTimeSeries,
          // NEW Phase 2: Heatmap & Retention
          activityHeatmap,
          watchTimePercentiles,
          // NEW Phase 3: Channels & Growth
          topChannels,
          topCategories,
          fastGrowingVideos
        }
      });

    } catch (error) {
      this.peertubeHelpers.logger.error('Stats error:', error);
      res.status(500).json({
        status: "failure",
        message: error.message
      });
    }
  }

  groupVideoViewsStats(request, groupBy) {
    let groupedStats = {};

    for (let i = 0; i < request.length; i++) {
      let format = "YYYY-MM-DD";
      if (groupBy === "month") format = "YYYY-MM";
      else if (groupBy === "year") format = "YYYY";

      const videoView = request[i];
      const date = moment(videoView.startDate).format(format);
      const dateKey = date;
      const videoKey = videoView.videoId;

      if (!groupedStats[dateKey]) {
        groupedStats[dateKey] = {};
      }

      if (!groupedStats[dateKey][videoKey]) {
        groupedStats[dateKey][videoKey] = { views: 0 };
      }

      groupedStats[dateKey][videoKey].views += videoView.views;
    }

    // Convert to array and sort
    const videoViewsStats = Object.keys(groupedStats).map(key => ({
      date: key,
      items: Object.keys(groupedStats[key]).map(videoKey => ({
        videoId: videoKey,
        views: groupedStats[key][videoKey].views
      }))
    }));

    return videoViewsStats.sort((a, b) =>
      moment(a.date).isAfter(moment(b.date)) ? 1 : -1
    );
  }

  registerRoutes(router) {
    // Статистики для админов
    router.get('/admin/stats',
      this.checkStatsAccess.bind(this),
      this.getInstanceStats.bind(this)
    );
  }
}

module.exports = StatsRoutes;