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

// 保存数据到GitHub
async function saveToGitHub(dateStr, data) {
  const path = GITHUB_CONFIG.dataPath + '/' + dateStr + '.json';
  const content = utf8ToBase64(JSON.stringify(data, null, 2));

  // 先检查文件是否已存在（获取SHA用于更新）
  let sha = null;
  try {
    const resp = await fetch('https://api.github.com/repos/' + GITHUB_CONFIG.owner + '/' + GITHUB_CONFIG.repo + '/contents/' + path + '?ref=' + GITHUB_CONFIG.branch, {
      headers: {
        'Authorization': 'Bearer ' + GITHUB_CONFIG.token,
        'Accept': 'application/vnd.github+json'
      }
    });
    if (resp.ok) {
      const existing = await resp.json();
      sha = existing.sha;
    }
  } catch(e) { /* 文件不存在，正常 */ }

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

  if (!resp.ok) {
    const err = await resp.json();
    throw new Error('保存失败：' + (err.message || '未知错误'));
  }
  return await resp.json();
}

// 从GitHub读取指定日期数据
async function loadFromGitHub(dateStr) {
  const path = GITHUB_CONFIG.dataPath + '/' + dateStr + '.json';
  try {
    const resp = await fetch('https://api.github.com/repos/' + GITHUB_CONFIG.owner + '/' + GITHUB_CONFIG.repo + '/contents/' + path + '?ref=' + GITHUB_CONFIG.branch, {
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
