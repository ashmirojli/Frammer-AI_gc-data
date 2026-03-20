/* =====================================================
   Multi-Dimensional Matrix Dashboard - Application Logic
   ===================================================== */

// =================== DATA LAYER ===================

const DATA_FILES = {
  dims: {
    channel:    { file: 'Dim_Channel.csv',     idCol: 'Channel_ID',    nameCol: 'Channel_Name' },
    user:       { file: 'Dim_User.csv',        idCol: 'User_ID',       nameCol: 'User_Name' },
    inputType:  { file: 'Dim_Input_Type.csv',  idCol: 'InputType_ID',  nameCol: 'Input_Type_Name' },
    language:   { file: 'Dim_Language.csv',     idCol: 'Language_ID',   nameCol: 'Language_Name' },
    month:      { file: 'Dim_Month.csv',       idCol: 'Month_ID',      nameCol: 'Month_Name' },
    outputType: { file: 'Dim_Output_Type.csv', idCol: 'OutputType_ID', nameCol: 'Output_Type_Name' },
    platform:   { file: 'Dim_Platform.csv',    idCol: 'Platform_ID',   nameCol: 'Platform_Name' },
    team:       { file: 'Dim_Team.csv',        idCol: 'Team_ID',       nameCol: 'Team_Name' },
  },
  facts: {
    userChannel:       'Fact_User_Channel.csv',
    channelPublishing: 'Fact_Channel_Publishing.csv',
    userSummary:       'Fact_User_Summary.csv',
    monthly:           'Fact_Monthly.csv',
    inputType:         'Fact_Input_Type.csv',
    language:          'Fact_Language.csv',
    outputType:        'Fact_Output_Type.csv',
    video:             'Fact_Video.csv',
  }
};

// Global data store
const DB = {
  dims: {},      // { channel: { 1: 'A', 2: 'B', ... }, ... }
  facts: {},     // { userChannel: [...rows], ... }
  videoIndex: [], // parsed Fact_Video rows
};

// State
const STATE = {
  dim1: 'channel',
  dim2: 'inputType',
  metric: 'uploaded_count',
  metricType: 'count',
  drillFilter: null,
  sortCol: null,
  sortDir: 'desc'
};

// ML data store
const ML = {
  loaded: false,
  error: null,
  dbscan: null,       // { clusters, user_assignments, channel_assignments, summary }
};

// =================== CSV PARSER ===================

function parseCSV(text) {
  const lines = text.trim().replace(/\r/g, '').split('\n');
  if (lines.length < 2) return [];
  const headers = parseCSVLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const vals = parseCSVLine(lines[i]);
    const row = {};
    headers.forEach((h, idx) => { row[h.trim()] = (vals[idx] || '').trim(); });
    rows.push(row);
  }
  return rows;
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuotes = !inQuotes; }
    else if (ch === ',' && !inQuotes) { result.push(current); current = ''; }
    else { current += ch; }
  }
  result.push(current);
  return result;
}

function parseDuration(str) {
  if (!str || str === '0:00:00' || str === '00:00:00') return 0;
  const parts = str.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 0;
}

function formatDuration(totalSec) {
  if (!totalSec || totalSec === 0) return '0:00';
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatNumber(n) {
  if (n === undefined || n === null) return '0';
  return Number(n).toLocaleString();
}

// =================== DATA LOADING ===================

async function loadAllData() {
  // Load dimensions
  for (const [key, cfg] of Object.entries(DATA_FILES.dims)) {
    try {
      const text = await fetch(cfg.file).then(r => r.text());
      const rows = parseCSV(text);
      DB.dims[key] = {};
      rows.forEach(r => {
        const id = parseInt(r[cfg.idCol]);
        if (!isNaN(id)) DB.dims[key][id] = r[cfg.nameCol] || `ID_${id}`;
      });
    } catch (e) { console.warn(`Failed to load ${cfg.file}:`, e); DB.dims[key] = {}; }
  }

  // Add Published Status as a synthetic dimension
  DB.dims.publishedStatus = { 1: 'Published', 2: 'Not Published' };

  // Load fact tables
  for (const [key, file] of Object.entries(DATA_FILES.facts)) {
    try {
      const text = await fetch(file).then(r => r.text());
      DB.facts[key] = parseCSV(text);
    } catch (e) { console.warn(`Failed to load ${file}:`, e); DB.facts[key] = []; }
  }

  // Build lookup maps
  DB.inputTypeNameToId = {};
  for (const [id, name] of Object.entries(DB.dims.inputType)) {
    DB.inputTypeNameToId[name.toLowerCase().trim()] = parseInt(id);
  }

  // Build user→channels distribution mapping from Fact_User_Channel
  DB.userChannelDistribution = {};
  DB.facts.userChannel.forEach(r => {
    const uid = parseInt(r['User_ID']);
    const cid = parseInt(r['Channel_ID']);
    const count = parseInt(r['Created Count']) || 1; // Fallback to 1 if 0
    if (!DB.userChannelDistribution[uid]) DB.userChannelDistribution[uid] = [];
    for(let i = 0; i < count; i++) {
        DB.userChannelDistribution[uid].push(cid);
    }
  });

  // Build user→language distribution from Fact_Language (proportional)
  // Since Fact_Video doesn't have language, we distribute using Fact_Language ratios
  DB.languageDistribution = buildDistribution('language', 'Language_ID');
  DB.monthDistribution = buildDistribution('monthly', 'Month_ID');
  DB.outputTypeDistribution = buildDistribution('outputType', 'OutputType_ID');
  DB.inputTypeDistribution = buildDistribution('inputType', 'InputType_ID');

  const userChannelIdx = {};

  // Parse video rows into structured format, assigning exactly one channel per video
  DB.videoIndex = DB.facts.video.map(r => {
    const uid = parseInt(r['User_ID']) || 0;
    let cid = 0;
    if (DB.userChannelDistribution[uid] && DB.userChannelDistribution[uid].length > 0) {
      if (userChannelIdx[uid] === undefined) userChannelIdx[uid] = 0;
      const arr = DB.userChannelDistribution[uid];
      cid = arr[userChannelIdx[uid] % arr.length];
      userChannelIdx[uid]++;
    }

    return {
      headline: r['Headline'] || '',
      published: (r['Published'] || '').toLowerCase() === 'yes',
      type: (r['Type'] || '').toLowerCase().trim(),
      videoId: r['Video ID'],
      userId: uid,
      teamId: parseInt(r['Team_ID']) || 0,
      platformId: parseFloat(r['Platform_ID']) || 0,
      channelId: cid,
    };
  });
}

/**
 * Build a distribution lookup from a 1D fact table.
 * Returns { [id]: { uploaded, created, published, ... } }
 */
function buildDistribution(factKey, idCol) {
  const result = {};
  const colMap = factKey === 'monthly'
    ? { up: 'Total Uploaded', cr: 'Total Created', pb: 'Total Published',
        upD: 'Total Uploaded Duration', crD: 'Total Created Duration', pbD: 'Total Published Duration' }
    : { up: 'Uploaded Count', cr: 'Created Count', pb: 'Published Count',
        upD: 'Uploaded Duration (hh:mm:ss)', crD: 'Created Duration (hh:mm:ss)', pbD: 'Published Duration (hh:mm:ss)' };

  DB.facts[factKey]?.forEach(r => {
    const id = parseInt(r[idCol]);
    if (!isNaN(id)) {
      result[id] = {
        uploaded: parseInt(r[colMap.up]) || 0,
        created: parseInt(r[colMap.cr]) || 0,
        published: parseInt(r[colMap.pb]) || 0,
        upDur: parseDuration(r[colMap.upD]),
        crDur: parseDuration(r[colMap.crD]),
        pbDur: parseDuration(r[colMap.pbD]),
      };
    }
  });
  return result;
}

// =================== DIMENSION HELPERS ===================

const DIMENSION_CONFIG = {
  channel:         { label: 'Channel',          dimKey: 'channel' },
  user:            { label: 'User',             dimKey: 'user' },
  inputType:       { label: 'Input Type',       dimKey: 'inputType' },
  language:        { label: 'Language',          dimKey: 'language' },
  month:           { label: 'Month',            dimKey: 'month' },
  outputType:      { label: 'Output Type',      dimKey: 'outputType' },
  platform:        { label: 'Platform',          dimKey: 'platform' },
  team:            { label: 'Team',             dimKey: 'team' },
  publishedStatus: { label: 'Published Status', dimKey: 'publishedStatus' },
};

// Which dimensions are directly available in Fact_Video
const VIDEO_DIMENSIONS = new Set(['user', 'channel', 'platform', 'team', 'publishedStatus']);
// Dimensions only available in 1D aggregate fact tables
const AGGREGATE_ONLY_DIMS = new Set(['language', 'month', 'outputType', 'inputType']);

function getDimName(dimKey, id) {
  return DB.dims[dimKey]?.[id] || `Unknown (${id})`;
}

function getDimIds(dimKey) {
  return Object.keys(DB.dims[dimKey] || {}).map(Number).sort((a, b) => a - b);
}

// =================== PIVOT ENGINE ===================

/**
 * Builds a 2D cross-tab matrix by aggregating Fact_Video records.
 */
function buildMatrixFromVideos(dim1Key, dim2Key) {
  const matrix = {};
  const rowTotals = {};
  const colTotals = {};
  let grandTotal = { count: 0, published: 0 };

  DB.videoIndex.forEach(v => {
    const rowIds = getVideoDimValues(v, dim1Key);
    const colIds = getVideoDimValues(v, dim2Key);

    rowIds.forEach(rId => {
      colIds.forEach(cId => {
        if (!matrix[rId]) matrix[rId] = {};
        if (!matrix[rId][cId]) matrix[rId][cId] = { count: 0, published: 0 };
        matrix[rId][cId].count++;
        if (v.published) matrix[rId][cId].published++;

        if (!rowTotals[rId]) rowTotals[rId] = { count: 0, published: 0 };
        rowTotals[rId].count++;
        if (v.published) rowTotals[rId].published++;

        if (!colTotals[cId]) colTotals[cId] = { count: 0, published: 0 };
        colTotals[cId].count++;
        if (v.published) colTotals[cId].published++;

        grandTotal.count++;
        if (v.published) grandTotal.published++;
      });
    });
  });

  return { matrix, rowTotals, colTotals, grandTotal };
}

/**
 * For pre-aggregated fact tables that directly contain both dimensions.
 */
function buildMatrixFromFactTable(factKey, dim1Col, dim2Col, countCol, durationCol, publishedCountCol) {
  const matrix = {};
  const rowTotals = {};
  const colTotals = {};
  let grandTotal = { count: 0, duration: 0, published: 0 };

  DB.facts[factKey].forEach(r => {
    const rId = parseInt(r[dim1Col]) || 0;
    const cId = parseInt(r[dim2Col]) || 0;
    const count = parseInt(r[countCol]) || 0;
    const dur = durationCol ? parseDuration(r[durationCol]) : 0;
    const pub = publishedCountCol ? (parseInt(r[publishedCountCol]) || 0) : 0;

    if (!matrix[rId]) matrix[rId] = {};
    if (!matrix[rId][cId]) matrix[rId][cId] = { count: 0, duration: 0, published: 0 };
    matrix[rId][cId].count += count;
    matrix[rId][cId].duration += dur;
    matrix[rId][cId].published += pub;

    if (!rowTotals[rId]) rowTotals[rId] = { count: 0, duration: 0, published: 0 };
    rowTotals[rId].count += count;
    rowTotals[rId].duration += dur;
    rowTotals[rId].published += pub;

    if (!colTotals[cId]) colTotals[cId] = { count: 0, duration: 0, published: 0 };
    colTotals[cId].count += count;
    colTotals[cId].duration += dur;
    colTotals[cId].published += pub;

    grandTotal.count += count;
    grandTotal.duration += dur;
    grandTotal.published += pub;
  });

  return { matrix, rowTotals, colTotals, grandTotal };
}

/**
 * Build a synthetic cross-tab when one dimension is aggregate-only.
 * Uses the 1D fact table data and distributes proportionally against a video dimension.
 */
function buildSyntheticMatrix(videoDim, aggDim) {
  const isVideoFirst = STATE.dim1 === videoDim;
  const actualVideoDim = videoDim;
  const actualAggDim = aggDim;

  // Get video-level counts per video dimension
  const videoAgg = {};
  DB.videoIndex.forEach(v => {
    const ids = getVideoDimValues(v, actualVideoDim);
    ids.forEach(id => {
      if (!videoAgg[id]) videoAgg[id] = { count: 0, published: 0 };
      videoAgg[id].count++;
      if (v.published) videoAgg[id].published++;
    });
  });

  // Get aggregate dimension data
  const aggData = getAggDistribution(actualAggDim);
  let totalAggCount = 0;
  Object.values(aggData).forEach(v => totalAggCount += v.created);

  const matrix = {};
  const rowTotals = {};
  const colTotals = {};
  let grandTotal = { count: 0, duration: 0, published: 0 };

  const rowDim = isVideoFirst ? actualVideoDim : actualAggDim;
  const colDim = isVideoFirst ? actualAggDim : actualVideoDim;

  const rowIds = isVideoFirst ? Object.keys(videoAgg).map(Number) : Object.keys(aggData).map(Number);
  const colIds = isVideoFirst ? Object.keys(aggData).map(Number) : Object.keys(videoAgg).map(Number);

  // Largest Remainder Method per videoCount to ensure exact sums
  rowIds.forEach(rId => {
    colIds.forEach(cId => {
      if (!matrix[rId]) matrix[rId] = {};
      matrix[rId][cId] = { count: 0, published: 0, duration: 0, _remainderObj: null };
    });
  });

  const distributeExact = (targetTotal, targetPub, targetDur, aggIds, isVideoRow, crossId) => {
    if (targetTotal <= 0) return;
    let allocatedTotal = 0;
    let allocatedPub = 0;
    
    const allocations = [];

    aggIds.forEach(aId => {
      const aggInfo = aggData[aId];
      if (!aggInfo || totalAggCount === 0) return;
      const ratio = aggInfo.created / totalAggCount;

      const exactCount = targetTotal * ratio;
      const exactPub = targetPub * ratio;
      const rId = isVideoRow ? crossId : aId;
      const cId = isVideoRow ? aId : crossId;

      const baseCount = Math.floor(exactCount);
      const basePub = Math.floor(exactPub);
      
      allocatedTotal += baseCount;
      allocatedPub += basePub;

      const dur = Math.round(aggInfo.crDur * (targetTotal / totalAggCount));

      matrix[rId][cId].count += baseCount;
      matrix[rId][cId].published += basePub;
      matrix[rId][cId].duration += dur;
      
      allocations.push({
        rId, cId,
        remainder: exactCount - baseCount,
        pubRemainder: exactPub - basePub
      });
    });

    // Distribute remaining count
    allocations.sort((a, b) => b.remainder - a.remainder);
    let diff = targetTotal - allocatedTotal;
    for (let i = 0; i < diff && i < allocations.length; i++) {
        matrix[allocations[i].rId][allocations[i].cId].count++;
    }

    // Distribute remaining pub
    allocations.sort((a, b) => b.pubRemainder - a.pubRemainder);
    let pubDiff = targetPub - allocatedPub;
    for (let i = 0; i < pubDiff && i < allocations.length; i++) {
        matrix[allocations[i].rId][allocations[i].cId].published++;
    }
  };

  if (isVideoFirst) {
    rowIds.forEach(rId => distributeExact(videoAgg[rId]?.count || 0, videoAgg[rId]?.published || 0, 0, colIds, true, rId));
  } else {
    colIds.forEach(cId => distributeExact(videoAgg[cId]?.count || 0, videoAgg[cId]?.published || 0, 0, rowIds, false, cId));
  }

  // Calculate totals
  rowIds.forEach(rId => {
    colIds.forEach(cId => {
      const cell = matrix[rId][cId];
      if (!rowTotals[rId]) rowTotals[rId] = { count: 0, published: 0, duration: 0 };
      rowTotals[rId].count += cell.count;
      rowTotals[rId].published += cell.published;
      rowTotals[rId].duration += cell.duration;

      if (!colTotals[cId]) colTotals[cId] = { count: 0, published: 0, duration: 0 };
      colTotals[cId].count += cell.count;
      colTotals[cId].published += cell.published;
      colTotals[cId].duration += cell.duration;

      grandTotal.count += cell.count;
      grandTotal.published += cell.published;
      grandTotal.duration += cell.duration;
    });
  });

  return { matrix, rowTotals, colTotals, grandTotal, isSynthetic: true };
}

/**
 * Build matrix when BOTH dimensions are aggregate-only.
 */
function buildDualAggregateMatrix(dim1, dim2) {
  const agg1 = getAggDistribution(dim1);
  const agg2 = getAggDistribution(dim2);
  let total1 = 0, total2 = 0;
  Object.values(agg1).forEach(v => total1 += v.created);
  Object.values(agg2).forEach(v => total2 += v.created);

  const totalVideos = total1; // Force total exact matching the 1D table
  const matrix = {};
  const rowTotals = {};
  const colTotals = {};
  let grandTotal = { count: 0, duration: 0, published: 0 };

  const rIds = Object.keys(agg1).map(Number);
  const cIds = Object.keys(agg2).map(Number);

  let allocatedTotal = 0;
  const allocations = [];

  rIds.forEach(rId => {
    cIds.forEach(cId => {
      const r1 = total1 > 0 ? agg1[rId].created / total1 : 0;
      const r2 = total2 > 0 ? agg2[cId].created / total2 : 0;
      const exactCount = totalVideos * r1 * r2;
      const baseCount = Math.floor(exactCount);
      const pub = Math.round(baseCount * 0.007); // Use overall publish rate
      
      allocatedTotal += baseCount;

      if (!matrix[rId]) matrix[rId] = {};
      matrix[rId][cId] = { count: baseCount, published: pub, duration: 0 };
      
      allocations.push({
        rId, cId,
        remainder: exactCount - baseCount
      });
    });
  });

  // Distribute remaining count
  allocations.sort((a, b) => b.remainder - a.remainder);
  let diff = totalVideos - allocatedTotal;
  for (let i = 0; i < diff && i < allocations.length; i++) {
      matrix[allocations[i].rId][allocations[i].cId].count++;
  }

  // Calculate totals
  rIds.forEach(rId => {
    cIds.forEach(cId => {
      const cell = matrix[rId][cId];
      if (cell.count === 0 && cell.published === 0) return;

      if (!rowTotals[rId]) rowTotals[rId] = { count: 0, published: 0, duration: 0 };
      rowTotals[rId].count += cell.count;
      rowTotals[rId].published += cell.published;

      if (!colTotals[cId]) colTotals[cId] = { count: 0, published: 0, duration: 0 };
      colTotals[cId].count += cell.count;
      colTotals[cId].published += cell.published;

      grandTotal.count += cell.count;
      grandTotal.published += cell.published;
    });
  });

  return { matrix, rowTotals, colTotals, grandTotal, isSynthetic: true };
}

function getAggDistribution(dimKey) {
  if (dimKey === 'language') return DB.languageDistribution;
  if (dimKey === 'month') return DB.monthDistribution;
  if (dimKey === 'outputType') return DB.outputTypeDistribution;
  if (dimKey === 'inputType') return DB.inputTypeDistribution;
  return {};
}

/**
 * Get dimension values for a video record.
 */
function getVideoDimValues(video, dimKey) {
  switch (dimKey) {
    case 'user':
      return video.userId ? [video.userId] : [];
    case 'channel':
      return video.channelId ? [video.channelId] : [];
    case 'inputType': {
      const typeId = DB.inputTypeNameToId[video.type];
      return typeId ? [typeId] : [];
    }
    case 'platform':
      return video.platformId ? [Math.round(video.platformId)] : [];
    case 'team':
      return video.teamId ? [video.teamId] : [];
    case 'publishedStatus':
      return video.published ? [1] : [2]; // 1=Published, 2=Not Published
    default:
      return [];
  }
}

/**
 * Resolve which data source and strategy to use for a given dim1 × dim2 combination.
 */
function resolveMatrixStrategy(dim1, dim2) {
  const pair = [dim1, dim2].sort().join('_');

  // Direct fact table matches
  if (pair === 'channel_user') {
    return {
      type: 'fact',
      factKey: 'userChannel',
      dim1Col: dim1 === 'user' ? 'User_ID' : 'Channel_ID',
      dim2Col: dim1 === 'user' ? 'Channel_ID' : 'User_ID',
      countCols: {
        uploaded_count: { count: 'Uploaded Count', duration: 'Uploaded Duration (hh:mm:ss)' },
        created_count:  { count: 'Created Count',  duration: 'Created Duration (hh:mm:ss)' },
        published_count:{ count: 'Published Count', duration: 'Published Duration (hh:mm:ss)' },
      }
    };
  }

  if (pair === 'channel_platform') {
    return {
      type: 'fact',
      factKey: 'channelPublishing',
      dim1Col: dim1 === 'channel' ? 'Channel_ID' : 'Platform_ID',
      dim2Col: dim1 === 'channel' ? 'Platform_ID' : 'Channel_ID',
      countCols: {
        published_count: { count: 'Published_Count', duration: 'Published_Duration' },
      }
    };
  }

  // Both dimensions available in Fact_Video
  if (VIDEO_DIMENSIONS.has(dim1) && VIDEO_DIMENSIONS.has(dim2)) {
    return { type: 'video' };
  }

  // One dimension is aggregate-only, one is in video
  const d1Agg = AGGREGATE_ONLY_DIMS.has(dim1);
  const d2Agg = AGGREGATE_ONLY_DIMS.has(dim2);

  if (d1Agg && !d2Agg) {
    return { type: 'synthetic', videoDim: dim2, aggDim: dim1 };
  }
  if (!d1Agg && d2Agg) {
    return { type: 'synthetic', videoDim: dim1, aggDim: dim2 };
  }

  // Both aggregate-only
  if (d1Agg && d2Agg) {
    return { type: 'dualAggregate' };
  }

  return { type: 'video' };
}

/**
 * Main pivot function - returns matrix data for the current dim1 × dim2.
 */
function buildCurrentMatrix() {
  const { dim1, dim2, metric } = STATE;
  const strategy = resolveMatrixStrategy(dim1, dim2);

  if (strategy.type === 'fact') {
    const metricKey = metric || 'uploaded_count';
    const cols = strategy.countCols[metricKey] || strategy.countCols[Object.keys(strategy.countCols)[0]];
    return buildMatrixFromFactTable(
      strategy.factKey,
      strategy.dim1Col,
      strategy.dim2Col,
      cols.count,
      cols.duration,
      metricKey === 'published_count' ? cols.count : null
    );
  }

  if (strategy.type === 'synthetic') {
    return buildSyntheticMatrix(strategy.videoDim, strategy.aggDim);
  }

  if (strategy.type === 'dualAggregate') {
    return buildDualAggregateMatrix(dim1, dim2);
  }

  // Video-based aggregation
  return buildMatrixFromVideos(dim1, dim2);
}

// =================== KPI CALCULATION ===================

function computeKPIs() {
  let totalUploaded = 0, totalCreated = 0, totalPublished = 0;
  let totalUpDur = 0, totalCreDur = 0, totalPubDur = 0;

  DB.facts.userSummary.forEach(r => {
    totalUploaded  += parseInt(r['Uploaded Count']) || 0;
    totalCreated   += parseInt(r['Created Count']) || 0;
    totalPublished += parseInt(r['Published Count']) || 0;
    totalUpDur     += parseDuration(r['Uploaded Duration (hh:mm:ss)']);
    totalCreDur    += parseDuration(r['Created Duration (hh:mm:ss)']);
    totalPubDur    += parseDuration(r['Published Duration (hh:mm:ss)']);
  });

  const conversionRate = totalCreated > 0 ? ((totalPublished / totalCreated) * 100).toFixed(1) : 0;

  return {
    totalUploaded, totalCreated, totalPublished,
    totalUpDur, totalCreDur, totalPubDur,
    totalVideos: DB.videoIndex.length,
    conversionRate,
  };
}

// =================== ANOMALY DETECTION ENGINE ===================

/**
 * Detect anomalies in the matrix using z-score analysis.
 * Returns a map: { 'rowId_colId': { type, severity, zScore, message } }
 */
function detectAnomalies(data, rowIds, colIds) {
  const anomalies = {}; // key: 'rId_cId'
  const alerts = [];    // list of alert objects

  if (rowIds.length < 2 || colIds.length < 2) return { anomalies, alerts };

  // Collect all cell values
  const allVals = [];
  const rowVals = {};  // rowId → [values]
  const colVals = {};  // colId → [values]

  rowIds.forEach(rId => {
    rowVals[rId] = [];
    colIds.forEach(cId => {
      const cell = data.matrix[rId]?.[cId];
      const val = cell ? getCellDisplayValue(cell) : 0;
      allVals.push(val);
      rowVals[rId].push(val);
      if (!colVals[cId]) colVals[cId] = [];
      colVals[cId].push(val);
    });
  });

  const globalStats = calcStats(allVals);
  if (globalStats.std === 0) return { anomalies, alerts };

  // Per-row anomalies (which column is unusually high/low within a row)
  rowIds.forEach(rId => {
    const rStats = calcStats(rowVals[rId]);
    colIds.forEach((cId, idx) => {
      const cell = data.matrix[rId]?.[cId];
      const val = cell ? getCellDisplayValue(cell) : 0;
      const key = `${rId}_${cId}`;

      // Row-relative z-score
      const rowZ = rStats.std > 0 ? (val - rStats.mean) / rStats.std : 0;
      // Global z-score
      const globalZ = (val - globalStats.mean) / globalStats.std;
      // Column-relative z-score
      const cStats = calcStats(colVals[cId]);
      const colZ = cStats.std > 0 ? (val - cStats.mean) / cStats.std : 0;

      // Combined anomaly score
      const maxZ = Math.max(Math.abs(rowZ), Math.abs(globalZ), Math.abs(colZ));

      if (maxZ >= 1.5 && val > 0) {
        const rowName = getDimName(STATE.dim1, rId);
        const colName = getDimName(STATE.dim2, cId);

        if (globalZ >= 2.5) {
          anomalies[key] = { type: 'exceptional', severity: 4, zScore: globalZ, icon: '⭐' };
          alerts.push({
            type: 'exceptional', severity: 4, icon: '⭐',
            message: `${rowName} × ${colName} is exceptional — ${formatCellValue(cell)} (${globalZ.toFixed(1)}σ above average)`,
            rowId: rId, colId: cId
          });
        } else if (globalZ >= 1.5) {
          anomalies[key] = { type: 'high', severity: 3, zScore: globalZ, icon: '🟢' };
          alerts.push({
            type: 'high', severity: 3, icon: '🟢',
            message: `${rowName} × ${colName} is a top performer — ${formatCellValue(cell)} (+${globalZ.toFixed(1)}σ)`,
            rowId: rId, colId: cId
          });
        } else if (globalZ <= -2.0 && val > 0) {
          anomalies[key] = { type: 'critical_low', severity: 4, zScore: globalZ, icon: '🔴' };
          alerts.push({
            type: 'critical_low', severity: 4, icon: '🔴',
            message: `${rowName} × ${colName} is critically low — ${formatCellValue(cell)} (${globalZ.toFixed(1)}σ below average)`,
            rowId: rId, colId: cId
          });
        } else if (globalZ <= -1.5 && val > 0) {
          anomalies[key] = { type: 'low', severity: 2, zScore: globalZ, icon: '🟡' };
          alerts.push({
            type: 'low', severity: 2, icon: '🟡',
            message: `${rowName} × ${colName} is unusually low — ${formatCellValue(cell)} (${Math.abs(globalZ).toFixed(1)}σ below)`,
            rowId: rId, colId: cId
          });
        }
      }
    });
  });

  // Sort alerts by severity desc, then z-score magnitude
  alerts.sort((a, b) => b.severity - a.severity || Math.abs(b.zScore || 0) - Math.abs(a.zScore || 0));

  // Also detect row-level anomalies (entire row is an outlier)
  const rowTotalVals = rowIds.map(rId => getCellDisplayValue(data.rowTotals[rId]));
  const rowTotalStats = calcStats(rowTotalVals);
  if (rowTotalStats.std > 0) {
    rowIds.forEach((rId, idx) => {
      const val = rowTotalVals[idx];
      const z = (val - rowTotalStats.mean) / rowTotalStats.std;
      const name = getDimName(STATE.dim1, rId);
      if (z >= 2.0) {
        alerts.push({
          type: 'row_high', severity: 3, icon: '📊',
          message: `${name} has significantly more activity than other ${DIMENSION_CONFIG[STATE.dim1].label}s (${formatNumber(val)} total, +${z.toFixed(1)}σ)`,
          rowId: rId
        });
      } else if (z <= -2.0 && val > 0) {
        alerts.push({
          type: 'row_low', severity: 2, icon: '📉',
          message: `${name} has significantly less activity than other ${DIMENSION_CONFIG[STATE.dim1].label}s (${formatNumber(val)} total, ${z.toFixed(1)}σ)`,
          rowId: rId
        });
      }
    });
  }

  alerts.sort((a, b) => b.severity - a.severity);
  return { anomalies, alerts };
}

function calcStats(values) {
  if (!values.length) return { mean: 0, std: 0, min: 0, max: 0 };
  const n = values.length;
  const mean = values.reduce((s, v) => s + v, 0) / n;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
  const std = Math.sqrt(variance);
  return { mean, std, min: Math.min(...values), max: Math.max(...values) };
}

// =================== RENDERING ===================

function renderApp() {
  const app = document.getElementById('app');
  app.innerHTML = '';

  renderHeader(app);
  renderBreadcrumb(app);
  renderControls(app);
  renderKPIs(app);

  // Build matrix data and detect anomalies
  const matrixData = buildCurrentMatrix();
  const { rowIds, colIds, maxVal } = getMatrixLayout(matrixData);
  const { anomalies, alerts } = detectAnomalies(matrixData, rowIds, colIds);

  renderAlertsPanel(app, alerts);
  renderMatrixSectionWithAnomalies(app, matrixData, rowIds, colIds, maxVal, anomalies);
  renderBreakdownGrid(app);

  // ML Insights panel (if backend data is loaded)
  if (ML.loaded) {
    renderMLInsights(app);
  }

  if (STATE.drillFilter) {
    renderDrillPanel(app);
  }
}

function renderHeader(container) {
  const div = document.createElement('div');
  div.className = 'dashboard-header';
  div.innerHTML = `
    <div>
      <h1 style="
        font-size: 2rem;
        font-weight: 900;
        letter-spacing: 0.08em;
        color: #ff3b3b;
        text-shadow: 0 0 12px rgba(255,59,59,0.7), 0 0 28px rgba(255,59,59,0.35);
        font-family: 'Arial Black', 'Impact', sans-serif;
        margin: 0;
        line-height: 1;
      ">FRAMMER AI</h1>
    </div>
    <div style="text-align: right">
      <div style="font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase;">Total Users</div>
      <div style="font-size: 1.2rem; font-weight: 700; color: var(--accent-primary);">${formatNumber(Object.keys(DB.dims.user).length)}</div>
    </div>
  `;
  container.appendChild(div);
}

function renderBreadcrumb(container) {
  const div = document.createElement('div');
  div.className = 'breadcrumb';

  let html = `<span class="crumb" onclick="clearDrill()">All Data</span>`;
  html += `<span class="sep">›</span>`;
  html += `<span class="current">${DIMENSION_CONFIG[STATE.dim1].label} × ${DIMENSION_CONFIG[STATE.dim2].label}</span>`;

  if (STATE.drillFilter) {
    html += `<span class="sep">›</span>`;
    html += `<span class="current" style="color:var(--accent-cyan)">
      ${DIMENSION_CONFIG[STATE.drillFilter.dim].label}: ${getDimName(STATE.drillFilter.dim, STATE.drillFilter.id)}
    </span>`;
  }

  div.innerHTML = html;
  container.appendChild(div);
}

function renderControls(container) {
  const div = document.createElement('div');
  div.className = 'controls-bar';

  div.innerHTML = `
    <div class="control-group">
      <label>Dimension 1 (Rows)</label>
      <select id="sel-dim1" onchange="changeDim1(this.value)">
        ${Object.entries(DIMENSION_CONFIG).map(([k, v]) =>
          `<option value="${k}" ${k === STATE.dim1 ? 'selected' : ''}>${v.label}</option>`
        ).join('')}
      </select>
    </div>
    <div class="control-group">
      <label>Dimension 2 (Columns)</label>
      <select id="sel-dim2" onchange="changeDim2(this.value)">
        ${Object.entries(DIMENSION_CONFIG).map(([k, v]) =>
          `<option value="${k}" ${k === STATE.dim2 ? 'selected' : ''}>${v.label}</option>`
        ).join('')}
      </select>
    </div>
    <div class="control-separator"></div>
    <div class="control-group">
      <label>Value</label>
      <div class="metric-toggle">
        <button class="${STATE.metricType === 'count' ? 'active' : ''}" onclick="changeMetricType('count')">Count</button>
        <button class="${STATE.metricType === 'duration' ? 'active' : ''}" onclick="changeMetricType('duration')">Duration</button>
        <button class="${STATE.metricType === 'conversion' ? 'active' : ''}" onclick="changeMetricType('conversion')">Conversion %</button>
      </div>
    </div>
  `;
  container.appendChild(div);
}

function renderKPIs(container) {
  const kpis = computeKPIs();
  const div = document.createElement('div');
  div.className = 'kpi-row';
  div.innerHTML = `
    <div class="kpi-card">
      <div class="kpi-label">Total Uploaded</div>
      <div class="kpi-value">${formatNumber(kpis.totalUploaded)}</div>
      <div class="kpi-sub">${formatDuration(kpis.totalUpDur)} total duration</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Total Created</div>
      <div class="kpi-value">${formatNumber(kpis.totalCreated)}</div>
      <div class="kpi-sub">${formatDuration(kpis.totalCreDur)} processing time</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Total Published</div>
      <div class="kpi-value">${formatNumber(kpis.totalPublished)}</div>
      <div class="kpi-sub">${formatDuration(kpis.totalPubDur)} published duration</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Publish Conversion</div>
      <div class="kpi-value">${kpis.conversionRate}%</div>
      <div class="kpi-sub">Published / Created ratio</div>
    </div>
  `;
  container.appendChild(div);
}

// =================== MATRIX RENDERING ===================

/**
 * Extract row/col IDs and max value from matrix data for layout.
 */
function getMatrixLayout(data) {
  const rowIds = Object.keys(data.rowTotals).map(Number).sort((a, b) => {
    return getCellDisplayValue(data.rowTotals[b]) - getCellDisplayValue(data.rowTotals[a]);
  });
  const colIdSet = new Set();
  rowIds.forEach(rId => {
    Object.keys(data.matrix[rId] || {}).forEach(cId => colIdSet.add(Number(cId)));
  });
  const colIds = [...colIdSet].sort((a, b) => {
    return getCellDisplayValue(data.colTotals[b]) - getCellDisplayValue(data.colTotals[a]);
  });
  let maxVal = 0;
  rowIds.forEach(rId => {
    colIds.forEach(cId => {
      const cell = data.matrix[rId]?.[cId];
      if (cell) maxVal = Math.max(maxVal, getCellDisplayValue(cell));
    });
  });
  return { rowIds, colIds, maxVal };
}

/**
 * Render the alerts panel summarizing detected anomalies.
 */
function renderAlertsPanel(container, alerts) {
  if (!alerts || alerts.length === 0) return;

  const panel = document.createElement('div');
  panel.className = 'alerts-panel';

  const highSeverity = alerts.filter(a => a.severity >= 3);
  const lowSeverity = alerts.filter(a => a.severity < 3);

  let html = `
    <div class="alerts-header">
      <div class="alerts-title">
        <span class="alerts-icon">🔔</span>
        <h3>Anomaly Detection</h3>
        <span class="alerts-count">${alerts.length} anomalies detected</span>
      </div>
      <button class="alerts-toggle" onclick="this.closest('.alerts-panel').classList.toggle('collapsed')">
        <span class="toggle-text">Collapse</span>
      </button>
    </div>
    <div class="alerts-body">
  `;

  if (highSeverity.length > 0) {
    html += `<div class="alerts-group">
      <div class="alerts-group-label">High Priority</div>`;
    highSeverity.slice(0, 8).forEach(a => {
      const cls = a.type.includes('low') || a.type.includes('low') ? 'alert-negative' : 'alert-positive';
      html += `<div class="alert-item ${cls}" onclick="${a.rowId ? `drillDown('${STATE.dim1}', ${a.rowId})` : ''}">
        <span class="alert-icon">${a.icon}</span>
        <span class="alert-text">${a.message}</span>
      </div>`;
    });
    html += `</div>`;
  }

  if (lowSeverity.length > 0) {
    html += `<div class="alerts-group">
      <div class="alerts-group-label">Observations</div>`;
    lowSeverity.slice(0, 6).forEach(a => {
      const cls = a.type.includes('low') ? 'alert-negative' : 'alert-neutral';
      html += `<div class="alert-item ${cls}">
        <span class="alert-icon">${a.icon}</span>
        <span class="alert-text">${a.message}</span>
      </div>`;
    });
    html += `</div>`;
  }

  html += `</div>`;
  panel.innerHTML = html;
  container.appendChild(panel);
}

/**
 * Render matrix section with anomaly badges on cells.
 */
function renderMatrixSectionWithAnomalies(container, data, rowIds, colIds, maxVal, anomalies) {
  const section = document.createElement('div');
  section.className = 'matrix-section';

  const dim1Label = DIMENSION_CONFIG[STATE.dim1].label;
  const dim2Label = DIMENSION_CONFIG[STATE.dim2].label;
  const strategy = resolveMatrixStrategy(STATE.dim1, STATE.dim2);
  let sourceTag = strategy.type === 'fact' ? 'Pre-Aggregated'
    : strategy.type === 'synthetic' ? 'Proportional Estimate'
    : strategy.type === 'dualAggregate' ? 'Estimated Distribution'
    : 'Video-Level Aggregation';

  let headerNote = '';
  if (data.isSynthetic) {
    headerNote = `<div style="font-size:0.72rem;color:var(--accent-amber);padding:8px 20px;border-bottom:1px solid var(--border-color);background:rgba(251,191,36,0.05)">
      ⚠️ Values are <strong>proportional estimates</strong> — actual per-cell values may differ.
    </div>`;
  }

  const anomalyCount = Object.keys(anomalies).length;
  const anomalyBadge = anomalyCount > 0
    ? `<span class="badge anomaly-badge">🔔 ${anomalyCount} anomalies</span>` : '';

  section.innerHTML = `
    <div class="matrix-section-header">
      <h2>${dim1Label} × ${dim2Label} Matrix</h2>
      <div style="display:flex;gap:8px;align-items:center">
        ${anomalyBadge}
        <span class="badge">${sourceTag} • ${rowIds.length} × ${colIds.length}</span>
      </div>
    </div>
    ${headerNote}
  `;

  if (rowIds.length === 0 || colIds.length === 0) {
    section.innerHTML += `<div class="empty-state"><div class="icon">📊</div><p>No data for this dimension combination</p></div>`;
    container.appendChild(section);
    return;
  }

  const wrapper = document.createElement('div');
  wrapper.className = 'matrix-wrapper';

  let html = '<table class="matrix-table"><thead><tr>';
  html += `<th>${dim1Label} ↓ / ${dim2Label} →</th>`;
  colIds.forEach(cId => {
    html += `<th onclick="drillDown('${STATE.dim2}', ${cId})" title="Click to drill into ${getDimName(STATE.dim2, cId)}">${getDimName(STATE.dim2, cId)}</th>`;
  });
  html += `<th class="total-col">Total</th></tr></thead><tbody>`;

  rowIds.forEach(rId => {
    html += '<tr>';
    html += `<td onclick="drillDown('${STATE.dim1}', ${rId})" title="Click to drill into ${getDimName(STATE.dim1, rId)}">${getDimName(STATE.dim1, rId)}</td>`;
    colIds.forEach(cId => {
      const cell = data.matrix[rId]?.[cId];
      const val = cell ? getCellDisplayValue(cell) : 0;
      const display = formatCellValue(cell);
      const heat = maxVal > 0 ? Math.round((val / maxVal) * 10) : 0;

      // Check for anomaly
      const aKey = `${rId}_${cId}`;
      const anomaly = anomalies[aKey];
      let anomalyClass = '';
      let anomalyIndicator = '';

      if (anomaly) {
        anomalyClass = ` anomaly-${anomaly.type}`;
        anomalyIndicator = `<span class="anomaly-dot" title="${anomaly.type}: z=${anomaly.zScore.toFixed(1)}σ">${anomaly.icon}</span>`;
      }

      html += `<td class="heatmap-cell heat-${heat} cell-clickable${anomalyClass}" onclick="drillDownCell('${STATE.dim1}', ${rId}, '${STATE.dim2}', ${cId})" title="${getDimName(STATE.dim1, rId)} × ${getDimName(STATE.dim2, cId)}: ${display}">${anomalyIndicator}${display}</td>`;
    });
    const rowTotal = formatCellValue(data.rowTotals[rId]);
    html += `<td class="total-col font-mono">${rowTotal}</td>`;
    html += '</tr>';
  });

  html += '<tr class="total-row">';
  html += '<td><strong>Total</strong></td>';
  colIds.forEach(cId => {
    html += `<td class="font-mono">${formatCellValue(data.colTotals[cId])}</td>`;
  });
  html += `<td class="total-col font-mono"><strong>${formatCellValue(data.grandTotal)}</strong></td>`;
  html += '</tr></tbody></table>';

  wrapper.innerHTML = html;
  section.appendChild(wrapper);
  container.appendChild(section);
}

function getCellDisplayValue(cell) {
  if (!cell) return 0;
  if (STATE.metricType === 'duration') return cell.duration || 0;
  if (STATE.metricType === 'conversion') {
    return cell.count > 0 ? (cell.published / cell.count) * 100 : 0;
  }
  return cell.count || 0;
}

function formatCellValue(cell) {
  if (!cell) return '—';
  if (STATE.metricType === 'duration') return formatDuration(cell.duration || 0);
  if (STATE.metricType === 'conversion') {
    const rate = cell.count > 0 ? ((cell.published / cell.count) * 100).toFixed(1) : 0;
    return rate + '%';
  }
  const val = cell.count || 0;
  return val === 0 ? '—' : formatNumber(val);
}

// =================== BREAKDOWN VIEWS ===================

function renderBreakdownGrid(container) {
  const grid = document.createElement('div');
  grid.className = 'breakdown-grid';

  renderBreakdownCard(grid, STATE.dim1, `${DIMENSION_CONFIG[STATE.dim1].label} Breakdown`);
  renderBreakdownCard(grid, STATE.dim2, `${DIMENSION_CONFIG[STATE.dim2].label} Breakdown`);

  container.appendChild(grid);
}

function renderBreakdownCard(container, dimKey, title) {
  const card = document.createElement('div');
  card.className = 'breakdown-card';

  // Aggregate data for this dimension
  const agg = {};

  if (AGGREGATE_ONLY_DIMS.has(dimKey)) {
    // Use pre-aggregated data
    const dist = getAggDistribution(dimKey);
    Object.entries(dist).forEach(([id, vals]) => {
      agg[Number(id)] = {
        count: vals.uploaded, published: vals.published,
        uploaded: vals.uploaded, created: vals.created,
        upDur: vals.upDur, creDur: vals.crDur, pubDur: vals.pbDur,
      };
    });
  } else {
    // From video records
    DB.videoIndex.forEach(v => {
      const ids = getVideoDimValues(v, dimKey);
      ids.forEach(id => {
        if (!agg[id]) agg[id] = { count: 0, published: 0 };
        agg[id].count++;
        if (v.published) agg[id].published++;
      });
    });
  }

  // Try pre-aggregated enrichment
  const preAgg = getPreAggregated(dimKey);
  if (preAgg) {
    Object.entries(preAgg).forEach(([id, vals]) => {
      const nId = Number(id);
      if (!agg[nId]) agg[nId] = { count: 0, published: 0 };
      Object.assign(agg[nId], vals);
    });
  }

  const entries = Object.entries(agg).map(([id, vals]) => ({
    id: Number(id),
    name: getDimName(dimKey, Number(id)),
    ...vals
  })).sort((a, b) => (b.uploaded || b.count || 0) - (a.uploaded || a.count || 0));

  const maxCount = (entries[0]?.uploaded || entries[0]?.count || 1);

  card.innerHTML = `
    <div class="breakdown-card-header">
      <h3>${title}</h3>
      <span style="font-size:0.72rem; color:var(--text-muted)">${entries.length} items</span>
    </div>
  `;

  const hasPreAgg = entries[0]?.uploaded !== undefined;

  let html = '<table class="breakdown-table"><thead><tr>';
  html += '<th>Name</th>';
  if (hasPreAgg) {
    html += '<th class="text-right">Uploaded</th><th class="text-right">Created</th><th class="text-right">Published</th>';
  } else {
    html += '<th class="text-right">Videos</th><th class="text-right">Published</th>';
  }
  html += '<th class="text-right">Conv%</th><th>Distribution</th>';
  html += '</tr></thead><tbody>';

  entries.slice(0, 25).forEach(e => {
    const num = hasPreAgg ? (e.uploaded || 0) : (e.count || 0);
    const den = hasPreAgg ? (e.created || 1) : (e.count || 1);
    const pub = e.published || 0;
    const conv = den > 0 ? ((pub / den) * 100).toFixed(1) : 0;
    const convClass = conv >= 5 ? 'high' : conv >= 1 ? 'medium' : 'low';
    const barW = Math.max(2, (num / maxCount) * 100);

    html += `<tr onclick="drillDown('${dimKey}', ${e.id})">`;
    html += `<td class="name-col">${e.name}</td>`;
    if (hasPreAgg) {
      html += `<td class="text-right font-mono">${formatNumber(e.uploaded)}</td>`;
      html += `<td class="text-right font-mono">${formatNumber(e.created)}</td>`;
      html += `<td class="text-right font-mono">${formatNumber(e.published)}</td>`;
    } else {
      html += `<td class="text-right font-mono">${formatNumber(e.count)}</td>`;
      html += `<td class="text-right font-mono">${formatNumber(pub)}</td>`;
    }
    html += `<td class="text-right"><span class="conversion-badge ${convClass}">${conv}%</span></td>`;
    html += `<td class="bar-cell"><div class="micro-bar" style="width:${barW}%"></div></td>`;
    html += '</tr>';
  });

  html += '</tbody></table>';

  const tableDiv = document.createElement('div');
  tableDiv.style.overflow = 'auto';
  tableDiv.style.maxHeight = '400px';
  tableDiv.innerHTML = html;
  card.appendChild(tableDiv);
  container.appendChild(card);
}

function getPreAggregated(dimKey) {
  const mapping = {
    user: {
      fact: 'userSummary', idCol: 'User_ID',
      uploaded: 'Uploaded Count', created: 'Created Count', published: 'Published Count',
      upDur: 'Uploaded Duration (hh:mm:ss)', creDur: 'Created Duration (hh:mm:ss)', pubDur: 'Published Duration (hh:mm:ss)'
    },
    inputType: {
      fact: 'inputType', idCol: 'InputType_ID',
      uploaded: 'Uploaded Count', created: 'Created Count', published: 'Published Count',
      upDur: 'Uploaded Duration (hh:mm:ss)', creDur: 'Created Duration (hh:mm:ss)', pubDur: 'Published Duration (hh:mm:ss)'
    },
    language: {
      fact: 'language', idCol: 'Language_ID',
      uploaded: 'Uploaded Count', created: 'Created Count', published: 'Published Count',
      upDur: 'Uploaded Duration (hh:mm:ss)', creDur: 'Created Duration (hh:mm:ss)', pubDur: 'Published Duration (hh:mm:ss)'
    },
    month: {
      fact: 'monthly', idCol: 'Month_ID',
      uploaded: 'Total Uploaded', created: 'Total Created', published: 'Total Published',
      upDur: 'Total Uploaded Duration', creDur: 'Total Created Duration', pubDur: 'Total Published Duration'
    },
    outputType: {
      fact: 'outputType', idCol: 'OutputType_ID',
      uploaded: 'Uploaded Count', created: 'Created Count', published: 'Published Count',
      upDur: 'Uploaded Duration (hh:mm:ss)', creDur: 'Created Duration (hh:mm:ss)', pubDur: 'Published Duration (hh:mm:ss)'
    },
  };

  const cfg = mapping[dimKey];
  if (!cfg) return null;

  const result = {};
  DB.facts[cfg.fact].forEach(r => {
    const id = parseInt(r[cfg.idCol]);
    result[id] = {
      uploaded: parseInt(r[cfg.uploaded]) || 0,
      created: parseInt(r[cfg.created]) || 0,
      pubCount: parseInt(r[cfg.published]) || 0,
      published: parseInt(r[cfg.published]) || 0,
      upDur: parseDuration(r[cfg.upDur]),
      creDur: parseDuration(r[cfg.creDur]),
      pubDur: parseDuration(r[cfg.pubDur]),
    };
  });
  return result;
}

// =================== DRILL-DOWN ===================

function renderDrillPanel(container) {
  const { dim, id } = STATE.drillFilter;
  const name = getDimName(dim, id);
  const panel = document.createElement('div');
  panel.className = 'drill-panel';

  panel.innerHTML = `
    <div class="drill-panel-header">
      <h3>🔍 Drill Down: ${DIMENSION_CONFIG[dim].label} = "${name}"</h3>
      <button class="drill-close-btn" onclick="clearDrill()">✕</button>
    </div>
    <div class="drill-panel-body" id="drill-body"></div>
  `;
  container.appendChild(panel);

  const body = panel.querySelector('#drill-body');

  // Filter videos for this dimension value
  const filtered = VIDEO_DIMENSIONS.has(dim)
    ? DB.videoIndex.filter(v => getVideoDimValues(v, dim).includes(id))
    : DB.videoIndex; // For aggregate dims, show all videos

  // Summary stats
  const summary = document.createElement('div');
  summary.style.cssText = 'display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap;';

  let drillKPIs = getDrillKPIs(dim, id, filtered);

  summary.innerHTML = `
    <div class="kpi-card" style="flex:1;min-width:150px;">
      <div class="kpi-label">Videos (Raw)</div>
      <div class="kpi-value" style="font-size:1.4rem;">${formatNumber(filtered.length)}</div>
    </div>
    <div class="kpi-card" style="flex:1;min-width:150px;">
      <div class="kpi-label">Uploaded</div>
      <div class="kpi-value" style="font-size:1.4rem;">${formatNumber(drillKPIs.uploaded)}</div>
      <div class="kpi-sub">${formatDuration(drillKPIs.upDur)}</div>
    </div>
    <div class="kpi-card" style="flex:1;min-width:150px;">
      <div class="kpi-label">Created</div>
      <div class="kpi-value" style="font-size:1.4rem;">${formatNumber(drillKPIs.created)}</div>
      <div class="kpi-sub">${formatDuration(drillKPIs.creDur)}</div>
    </div>
    <div class="kpi-card" style="flex:1;min-width:150px;">
      <div class="kpi-label">Published</div>
      <div class="kpi-value" style="font-size:1.4rem;">${formatNumber(drillKPIs.published)}</div>
      <div class="kpi-sub">Conv: ${drillKPIs.created > 0 ? ((drillKPIs.published / drillKPIs.created) * 100).toFixed(1) : 0}%</div>
    </div>
  `;
  body.appendChild(summary);

  // Show breakdown by other dimensions
  const otherDims = Object.keys(DIMENSION_CONFIG).filter(d => d !== dim);
  const grid = document.createElement('div');
  grid.className = 'breakdown-grid';

  otherDims.slice(0, 6).forEach(odim => {
    const agg = getDrillBreakdown(dim, id, odim, filtered);

    const entries = Object.entries(agg).map(([eid, vals]) => ({
      id: Number(eid), name: getDimName(odim, Number(eid)), ...vals
    })).sort((a, b) => (b.uploaded || b.count || 0) - (a.uploaded || a.count || 0));

    if (entries.length === 0) return;

    const maxC = entries[0].uploaded || entries[0].count || 1;
    const card = document.createElement('div');
    card.className = 'breakdown-card';
    const hasPreAgg = entries[0].uploaded !== undefined;

    let html = `<div class="breakdown-card-header"><h3>By ${DIMENSION_CONFIG[odim].label}</h3><span style="font-size:0.72rem;color:var(--text-muted)">${entries.length}</span></div>`;
    html += '<div style="overflow:auto;max-height:280px"><table class="breakdown-table"><thead><tr><th>Name</th>';
    if (hasPreAgg) {
      html += '<th class="text-right">Uploaded</th><th class="text-right">Created</th><th class="text-right">Published</th>';
    } else {
      html += '<th class="text-right">Videos</th><th class="text-right">Published</th>';
    }
    html += '<th class="text-right">Conv%</th><th>Bar</th></tr></thead><tbody>';

    entries.slice(0, 20).forEach(e => {
      const num = hasPreAgg ? (e.uploaded || 0) : (e.count || 0);
      const den = hasPreAgg ? (e.created || 1) : (e.count || 1);
      const pub = hasPreAgg ? (e.published || 0) : (e.published || 0);
      const conv = den > 0 ? ((pub / den) * 100).toFixed(1) : 0;
      const convCls = conv >= 5 ? 'high' : conv >= 1 ? 'medium' : 'low';
      const bw = Math.max(2, (num / maxC) * 100);

      html += `<tr><td class="name-col">${e.name}</td>`;
      if (hasPreAgg) {
        html += `<td class="text-right font-mono">${formatNumber(e.uploaded)}</td>`;
        html += `<td class="text-right font-mono">${formatNumber(e.created)}</td>`;
        html += `<td class="text-right font-mono">${formatNumber(e.published)}</td>`;
      } else {
        html += `<td class="text-right font-mono">${formatNumber(e.count)}</td>`;
        html += `<td class="text-right font-mono">${e.published}</td>`;
      }
      html += `<td class="text-right"><span class="conversion-badge ${convCls}">${conv}%</span></td>`;
      html += `<td class="bar-cell"><div class="micro-bar" style="width:${bw}%"></div></td></tr>`;
    });

    html += '</tbody></table></div>';
    card.innerHTML = html;
    grid.appendChild(card);
  });

  body.appendChild(grid);
}

function getDrillKPIs(dim, id, filteredVideos) {
  const defaults = {
    uploaded: filteredVideos.length,
    created: filteredVideos.length,
    published: filteredVideos.filter(v => v.published).length,
    upDur: 0, creDur: 0, pubDur: 0
  };

  if (dim === 'user') {
    const row = DB.facts.userSummary.find(r => parseInt(r['User_ID']) === id);
    if (row) return {
      uploaded: parseInt(row['Uploaded Count']) || 0,
      created: parseInt(row['Created Count']) || 0,
      published: parseInt(row['Published Count']) || 0,
      upDur: parseDuration(row['Uploaded Duration (hh:mm:ss)']),
      creDur: parseDuration(row['Created Duration (hh:mm:ss)']),
      pubDur: parseDuration(row['Published Duration (hh:mm:ss)']),
    };
  }

  const preAgg = getPreAggregated(dim);
  if (preAgg && preAgg[id]) {
    return {
      uploaded: preAgg[id].uploaded,
      created: preAgg[id].created,
      published: preAgg[id].published || preAgg[id].pubCount,
      upDur: preAgg[id].upDur,
      creDur: preAgg[id].creDur,
      pubDur: preAgg[id].pubDur,
    };
  }

  return defaults;
}

function getDrillBreakdown(drillDim, drillId, breakdownDim, filteredVideos) {
  // User → Channel: use Fact_User_Channel directly
  if (drillDim === 'user' && breakdownDim === 'channel') {
    const agg = {};
    DB.facts.userChannel.forEach(r => {
      if (parseInt(r['User_ID']) === drillId) {
        const cid = parseInt(r['Channel_ID']);
        agg[cid] = {
          uploaded: parseInt(r['Uploaded Count']) || 0,
          created: parseInt(r['Created Count']) || 0,
          published: parseInt(r['Published Count']) || 0,
        };
      }
    });
    return agg;
  }

  // Channel → User: use Fact_User_Channel directly
  if (drillDim === 'channel' && breakdownDim === 'user') {
    const agg = {};
    DB.facts.userChannel.forEach(r => {
      if (parseInt(r['Channel_ID']) === drillId) {
        const uid = parseInt(r['User_ID']);
        agg[uid] = {
          uploaded: parseInt(r['Uploaded Count']) || 0,
          created: parseInt(r['Created Count']) || 0,
          published: parseInt(r['Published Count']) || 0,
        };
      }
    });
    return agg;
  }

  // Channel → Platform: use Fact_Channel_Publishing directly
  if (drillDim === 'channel' && breakdownDim === 'platform') {
    const agg = {};
    DB.facts.channelPublishing.forEach(r => {
      if (parseInt(r['Channel_ID']) === drillId) {
        const pid = parseInt(r['Platform_ID']);
        const count = parseInt(r['Published_Count']) || 0;
        if (count > 0) {
          agg[pid] = { uploaded: count, created: count, published: count };
        }
      }
    });
    return agg;
  }

  // For aggregate-only dimensions as breakdown target, use 1D pre-aggregated data
  if (AGGREGATE_ONLY_DIMS.has(breakdownDim)) {
    const dist = getAggDistribution(breakdownDim);
    const result = {};
    Object.entries(dist).forEach(([id, vals]) => {
      result[Number(id)] = {
        uploaded: vals.uploaded, created: vals.created, published: vals.published,
      };
    });
    return result;
  }

  // Default: aggregate from filtered videos
  const agg = {};
  filteredVideos.forEach(v => {
    const ids = getVideoDimValues(v, breakdownDim);
    ids.forEach(oid => {
      if (!agg[oid]) agg[oid] = { count: 0, published: 0 };
      agg[oid].count++;
      if (v.published) agg[oid].published++;
    });
  });
  return agg;
}

// =================== EVENT HANDLERS ===================

function changeDim1(val) {
  STATE.dim1 = val;
  STATE.drillFilter = null;
  renderApp();
}

function changeDim2(val) {
  STATE.dim2 = val;
  STATE.drillFilter = null;
  renderApp();
}

function changeMetric(val) {
  STATE.metric = val;
  renderApp();
}

function changeMetricType(val) {
  STATE.metricType = val;
  renderApp();
}

function drillDown(dim, id) {
  STATE.drillFilter = { dim, id: Number(id) };
  renderApp();
  setTimeout(() => {
    const panel = document.querySelector('.drill-panel');
    if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 100);
}

function drillDownCell(dim1, id1, dim2, id2) {
  drillDown(dim1, id1);
}

function clearDrill() {
  STATE.drillFilter = null;
  renderApp();
}

// =================== BOOTSTRAP ===================

async function loadMLData() {
  try {
    const dbRes = await fetch('http://localhost:5000/api/clusters').then(r => r.json());
    ML.dbscan = dbRes;
    ML.loaded = true;
    ML.error = null;
    console.log('ML Backend DBSCAN connected:', dbRes.summary);
  } catch (e) {
    ML.loaded = false;
    ML.error = 'ML backend not running. Start with: python backend.py';
    console.log('ML backend not available:', e.message);
  }
}

async function init() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="loading-overlay">
      <div class="spinner"></div>
      <div class="loading-text">Loading Frammer Analytics Data...</div>
    </div>
  `;

  await loadAllData();
  await loadMLData();
  renderApp();
}

document.addEventListener('DOMContentLoaded', init);

// =================== ML INSIGHTS PANEL ===================

function renderMLInsights(container) {
  const div = document.createElement('div');
  div.className = 'ml-insights-panel';
  
  div.innerHTML = `
    <div class="ml-header d-flex justify-between align-center">
      <div class="d-flex align-center" style="gap: 12px">
        <div class="ml-icon">🧠</div>
        <div>
          <h2>ML-Powered Insights</h2>
          <div class="text-muted" style="font-size: 0.85rem">scikit-learn Backend</div>
        </div>
      </div>
    </div>
    <div class="ml-body" id="ml-body"></div>
  `;
  container.appendChild(div);

  const mlBody = div.querySelector('#ml-body');
  renderDBSCAN(mlBody);
}

// =================== DBSCAN PANEL ===================

function renderDBSCAN(container) {
  const data = ML.dbscan;
  if (!data) return;

  const clusters = data.clusters;
  const users = data.user_assignments;
  const channels = data.channel_assignments;

  // Summary
  let html = `
    <div class="ml-summary">
      <div class="ml-summary-card">
        <div class="ml-summary-label">Model</div>
        <div class="ml-summary-value">DBSCAN</div>
        <div class="ml-summary-sub">eps=${data.summary.parameters.eps}, min_samples=${data.summary.parameters.min_samples}</div>
      </div>
      <div class="ml-summary-card">
        <div class="ml-summary-label">Users Analyzed</div>
        <div class="ml-summary-value">${data.summary.total_users}</div>
        <div class="ml-summary-sub">From Fact_User_Summary</div>
      </div>
      <div class="ml-summary-card">
        <div class="ml-summary-label">Clusters Found</div>
        <div class="ml-summary-value">${data.summary.user_clusters}</div>
        <div class="ml-summary-sub">Natural behavior groups</div>
      </div>
      <div class="ml-summary-card anomaly-highlight">
        <div class="ml-summary-label">Behavioral Outliers</div>
        <div class="ml-summary-value">${data.summary.user_outliers}</div>
        <div class="ml-summary-sub">Don't fit any cluster</div>
      </div>
    </div>

    <div class="ml-explanation">
      <strong>How it works:</strong> DBSCAN groups users by measuring <em>density</em> in feature space. 
      Users close together (similar upload/create/publish patterns) form clusters. 
      Users in sparse regions — with unique behavior patterns — are labeled as outliers. 
      Unlike K-means, DBSCAN doesn't need a pre-set number of clusters.
    </div>
  `;

  // Cluster cards
  html += '<div class="cluster-grid">';
  const sortedClusters = Object.values(clusters).sort((a, b) => {
    if (a.is_noise) return 1;
    if (b.is_noise) return -1;
    return b.avg_uploaded - a.avg_uploaded;
  });

  const clusterColors = ['#ffffff', '#a3a3a3', '#737373', '#555555'];

  sortedClusters.forEach((c, i) => {
    const color = c.is_noise ? 'var(--accent-primary)' : (clusterColors[i % clusterColors.length]);
    const members = users.filter(u => u.cluster_id === c.id);

    html += `<div class="cluster-card" style="border-left: 4px solid ${color}">
      <div class="cluster-header">
        <span class="cluster-label" style="color:${color}">${c.label}</span>
        <span class="cluster-size">${c.size} users</span>
      </div>
      <div class="cluster-stats">
        <div class="cluster-stat">
          <span class="stat-label">Avg Uploaded</span>
          <span class="stat-value">${formatNumber(Math.round(c.avg_uploaded))}</span>
        </div>
        <div class="cluster-stat">
          <span class="stat-label">Avg Created</span>
          <span class="stat-value">${formatNumber(Math.round(c.avg_created))}</span>
        </div>
        <div class="cluster-stat">
          <span class="stat-label">Avg Published</span>
          <span class="stat-value">${formatNumber(Math.round(c.avg_published))}</span>
        </div>
        <div class="cluster-stat">
          <span class="stat-label">Avg Conv%</span>
          <span class="stat-value">${c.avg_conversion}%</span>
        </div>
      </div>
      <div class="cluster-members">
        ${members.slice(0, 8).map(m => 
          `<span class="member-tag" style="border-color:${color}40;color:${color}" title="Uploaded: ${m.uploaded}, Created: ${m.created}">${m.user_name}</span>`
        ).join('')}
        ${members.length > 8 ? `<span class="member-more">+${members.length - 8} more</span>` : ''}
      </div>
    </div>`;
  });
  html += '</div>';

  container.innerHTML = html;
}
