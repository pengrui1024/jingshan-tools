// GitHub数据同步模块
// 使用GitHub Contents API实现云端数据存储
// Token通过本地输入保存，不硬编码在代码中

const GITHUB_CONFIG = {
  token: localStorage.getItem('gh_token') || '',
  owner: 'pengrui1024',
  repo: 'jingshan-tools',
  branch: 'main',
  dataPath: 'data/8421'
};

// 保存Token到本地
function saveToken(token) {
  localStorage.setItem('gh_token', token);
  GITHUB_CONFIG.token = token;
}

// Base64编码（UTF-8安全）
function utf8ToBase64(str) {
  return btoa(unescape(encodeURIComponent(str)));
}

// Base64解码（UTF-8安全）
function base64ToUtf8(b64) {
  return decodeURIComponent(escape(atob(b64)));
}

// 获取云端文件的SHA（不存在返回null）
async function getFileSha(path) {
  try {
    const ts = Date.now();
    const resp = await fetch('https://api.github.com/repos/' + GITHUB_CONFIG.owner + '/' + GITHUB_CONFIG.repo + '/contents/' + path + '?ref=' + GITHUB_CONFIG.branch + '&t=' + ts, {
      headers: {
        'Authorization': 'Bearer ' + GITHUB_CONFIG.token,
        'Accept': 'application/vnd.github+json'
      }
    });
    if (resp.ok) {
      const existing = await resp.json();
      return existing.sha || null;
    }
  } catch(e) { /* 文件不存在，正常 */ }
  return null;
}

// 内存缓存：最近一次PUT成功的文件SHA（解决GitHub API缓存导致读到旧SHA的问题）
const shaCache = {};

// 保存数据到GitHub（带SHA缓存与冲突重试）
async function saveToGitHub(dateStr, data) {
  const path = GITHUB_CONFIG.dataPath + '/' + dateStr + '.json';
  const content = utf8ToBase64(JSON.stringify(data, null, 2));

  // 最多重试4次，避免并发写入的SHA冲突
  let lastErr = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    // 优先使用内存缓存的SHA（最新），否则实时获取
    let sha = shaCache[path];
    if (!sha) {
      sha = await getFileSha(path);
      if (sha) shaCache[path] = sha;
    }

    const body = {
      message: '更新8421数据：' + dateStr,
      branch: GITHUB_CONFIG.branch,
      content: content
    };
    if (sha) body.sha = sha;

    const resp = await fetch('https://api.github.com/repos/' + GITHUB_CONFIG.owner + '/' + GITHUB_CONFIG.repo + '/contents/' + path, {
      method: 'PUT',
      headers: {
        'Authorization': 'Bearer ' + GITHUB_CONFIG.token,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (resp.ok) {
      const result = await resp.json();
      // 更新内存SHA缓存
      if (result && result.content) shaCache[path] = result.content.sha;
      return result;
    }

    const err = await resp.json();
    lastErr = err;
    // SHA冲突（409）时：清掉缓存，重新获取真实SHA再试
    if (resp.status === 409 || (err.message && err.message.indexOf('does not match') >= 0)) {
      delete shaCache[path];
      await new Promise(r => setTimeout(r, 800));
      continue;
    }
    throw new Error('保存失败：' + (err.message || '未知错误'));
  }
  throw new Error('保存失败：' + (lastErr && lastErr.message || '未知错误'));
}

// 从GitHub读取指定日期数据
async function loadFromGitHub(dateStr) {
  const path = GITHUB_CONFIG.dataPath + '/' + dateStr + '.json';
  try {
    const ts = Date.now();
    const resp = await fetch('https://api.github.com/repos/' + GITHUB_CONFIG.owner + '/' + GITHUB_CONFIG.repo + '/contents/' + path + '?ref=' + GITHUB_CONFIG.branch + '&t=' + ts, {
      headers: {
        'Authorization': 'Bearer ' + GITHUB_CONFIG.token,
        'Accept': 'application/vnd.github+json'
      }
    });
    if (!resp.ok) return null;
    const result = await resp.json();
    return JSON.parse(base64ToUtf8(result.content));
  } catch(e) {
    return null;
  }
}

// 列出GitHub上所有已保存的日期
async function listGitHubData() {
  try {
    const resp = await fetch('https://api.github.com/repos/' + GITHUB_CONFIG.owner + '/' + GITHUB_CONFIG.repo + '/contents/' + GITHUB_CONFIG.dataPath + '?ref=' + GITHUB_CONFIG.branch, {
      headers: {
        'Authorization': 'Bearer ' + GITHUB_CONFIG.token,
        'Accept': 'application/vnd.github+json'
      }
    });
    if (!resp.ok) return [];
    const files = await resp.json();
    if (!Array.isArray(files)) return [];
    return files.map(function(f) {
      return f.name.replace('.json', '');
    }).sort().reverse();
  } catch(e) {
    return [];
  }
}

// 从GitHub加载指定日期数据并填充表单
async function loadGitHubData(dateStr) {
  const data = await loadFromGitHub(dateStr);
  if (data) {
    fillData(data);
    return true;
  }
  return false;
}

/* ========== 831 专用 ========== */
const GITHUB_831_PATH = 'data/831';

// 保存831数据到GitHub（带SHA缓存与冲突重试）
async function saveToGitHub831(dateStr, data) {
  const path = GITHUB_831_PATH + '/' + dateStr + '.json';
  const content = utf8ToBase64(JSON.stringify(data, null, 2));

  let lastErr = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    let sha = shaCache[path];
    if (!sha) {
      sha = await getFileSha831(path);
      if (sha) shaCache[path] = sha;
    }

    const body = {
      message: '更新831数据：' + dateStr,
      branch: GITHUB_CONFIG.branch,
      content: content
    };
    if (sha) body.sha = sha;

    const resp = await fetch('https://api.github.com/repos/' + GITHUB_CONFIG.owner + '/' + GITHUB_CONFIG.repo + '/contents/' + path, {
      method: 'PUT',
      headers: {
        'Authorization': 'Bearer ' + GITHUB_CONFIG.token,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (resp.ok) {
      const result = await resp.json();
      if (result && result.content) shaCache[path] = result.content.sha;
      return result;
    }

    const err = await resp.json();
    lastErr = err;
    if (resp.status === 409 || (err.message && err.message.indexOf('does not match') >= 0)) {
      delete shaCache[path];
      await new Promise(r => setTimeout(r, 800));
      continue;
    }
    throw new Error('保存失败：' + (err.message || '未知错误'));
  }
  throw new Error('保存失败：' + (lastErr && lastErr.message || '未知错误'));
}

// 读取831指定日期数据
async function loadFromGitHub831(dateStr) {
  const path = GITHUB_831_PATH + '/' + dateStr + '.json';
  try {
    const ts = Date.now();
    const resp = await fetch('https://api.github.com/repos/' + GITHUB_CONFIG.owner + '/' + GITHUB_CONFIG.repo + '/contents/' + path + '?ref=' + GITHUB_CONFIG.branch + '&t=' + ts, {
      headers: {
        'Authorization': 'Bearer ' + GITHUB_CONFIG.token,
        'Accept': 'application/vnd.github+json'
      }
    });
    if (!resp.ok) return null;
    const result = await resp.json();
    return JSON.parse(base64ToUtf8(result.content));
  } catch(e) {
    return null;
  }
}

// 获取831文件SHA
async function getFileSha831(path) {
  try {
    const ts = Date.now();
    const resp = await fetch('https://api.github.com/repos/' + GITHUB_CONFIG.owner + '/' + GITHUB_CONFIG.repo + '/contents/' + path + '?ref=' + GITHUB_CONFIG.branch + '&t=' + ts, {
      headers: {
        'Authorization': 'Bearer ' + GITHUB_CONFIG.token,
        'Accept': 'application/vnd.github+json'
      }
    });
    if (resp.ok) {
      const existing = await resp.json();
      return existing.sha || null;
    }
  } catch(e) { /* 文件不存在，正常 */ }
  return null;
}

// 831加载数据并填充表单
async function loadGitHubData831(dateStr) {
  const data = await loadFromGitHub831(dateStr);
  if (data) {
    fillData(data);
    return true;
  }
  return false;
}
