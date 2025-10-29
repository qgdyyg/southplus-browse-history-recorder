document.addEventListener('DOMContentLoaded', () => {
  loadHistory();
  bindEvents();
});

function bindEvents() {
  // 搜索功能
  document.getElementById('searchInput').addEventListener('input', (e) => {
    const keyword = e.target.value.toLowerCase().trim();
    filterHistory(keyword);
  });

  // 导出记录
  document.getElementById('exportBtn').addEventListener('click', exportHistory);

  // 导入记录
  document.getElementById('importBtn').addEventListener('click', () => {
    document.getElementById('importFile').click();
  });

  // 处理导入文件
  document.getElementById('importFile').addEventListener('change', importHistory);

  // 清空记录
  document.getElementById('clearBtn').addEventListener('click', clearHistory);
}

// 加载历史记录并显示
function loadHistory() {
  chrome.storage.local.get(['browseHistory'], (result) => {
    const historyList = document.getElementById('historyList');
    historyList.innerHTML = '';

    let history = result.browseHistory || [];

    // 统一时间格式并排序
    history = history
      .map(item => ({
        ...item,
        visitedAt: typeof item.visitedAt === 'string' 
          ? new Date(item.visitedAt).getTime() 
          : item.visitedAt
      }))
      .sort((a, b) => b.visitedAt - a.visitedAt);

    if (history.length === 0) {
      historyList.innerHTML = '<div style="text-align:center;padding:20px;">暂无浏览记录</div>';
      return;
    }

    // 渲染记录
    history.forEach(item => {
      const itemDiv = document.createElement('div');
      itemDiv.className = 'history-item';
      itemDiv.innerHTML = `
        <div class="title"><a href="${item.url}" target="_blank">${item.title}</a></div>
        <div class="url">${item.url}</div>
        <div class="date">
          访问时间: ${formatLocalTime(item.visitedAt)}
          <span style="font-size:10px;color:#999;">（时间戳：${item.visitedAt}）</span>
        </div>
      `;
      historyList.appendChild(itemDiv);
    });

    // 应用当前搜索关键词
    const currentKeyword = document.getElementById('searchInput').value.toLowerCase().trim();
    if (currentKeyword) filterHistory(currentKeyword);
  });
}

// 搜索过滤记录
function filterHistory(keyword) {
  const items = document.querySelectorAll('.history-item');
  items.forEach(item => {
    const title = item.querySelector('.title').textContent.toLowerCase();
    const url = item.querySelector('.url').textContent.toLowerCase();
    const isMatch = title.includes(keyword) || url.includes(keyword);
    item.style.display = isMatch ? 'block' : 'none';
  });
}

// 格式化本地时间
function formatLocalTime(timestamp) {
  const date = new Date(timestamp);
  return [
    date.getFullYear(),
    padZero(date.getMonth() + 1),
    padZero(date.getDate())
  ].join('-') + ' ' + [
    padZero(date.getHours()),
    padZero(date.getMinutes()),
    padZero(date.getSeconds())
  ].join(':');
}

// 数字补零
function padZero(num) {
  return num < 10 ? '0' + num : num;
}

// 导出记录
function exportHistory() {
  chrome.storage.local.get(['browseHistory'], (result) => {
    if (chrome.runtime.lastError) {
      alert('导出失败：无法读取数据');
      return;
    }

    let history = result.browseHistory || [];
    history = history.map(item => ({
      ...item,
      visitedAt: typeof item.visitedAt === 'string' ? new Date(item.visitedAt).getTime() : item.visitedAt
    })).sort((a, b) => b.visitedAt - a.visitedAt);

    if (history.length === 0) {
      alert('没有可导出的记录');
      return;
    }

    const dataStr = JSON.stringify(history, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `浏览记录_${formatLocalTime(Date.now()).split(' ')[0]}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 100);
  });
}

// 导入记录
function importHistory(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const importedData = JSON.parse(e.target.result);
      if (!Array.isArray(importedData)) throw new Error('数据必须是数组');

      chrome.storage.local.get(['browseHistory'], (result) => {
        let history = result.browseHistory || [];

        importedData.forEach(item => {
          if (!item.url || !item.title) return;
          const visitedAt = typeof item.visitedAt === 'string' 
            ? new Date(item.visitedAt).getTime() 
            : (typeof item.visitedAt === 'number' ? item.visitedAt : Date.now());
          if (!history.some(h => h.url === item.url)) {
            history.push({ ...item, visitedAt });
          }
        });

        history.sort((a, b) => b.visitedAt - a.visitedAt);
        chrome.storage.local.set({ browseHistory: history }, () => {
          loadHistory();
          alert(`导入成功，总记录数：${history.length}`);
        });
      });
    } catch (error) {
      alert('导入失败：' + error.message);
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}

// 清空记录
function clearHistory() {
  if (confirm('确定清空所有记录？')) {
    chrome.storage.local.set({ browseHistory: [] }, () => {
      loadHistory();
      alert('记录已清空');
    });
  }
}