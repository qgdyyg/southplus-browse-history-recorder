document.addEventListener('DOMContentLoaded', () => {
  loadHistory();
  bindEvents();
});

function bindEvents() {
  document.getElementById('exportBtn').addEventListener('click', exportHistory);
  document.getElementById('importBtn').addEventListener('click', () => {
    document.getElementById('importFile').click();
  });
  document.getElementById('importFile').addEventListener('change', importHistory);
  document.getElementById('clearBtn').addEventListener('click', clearHistory);
}

function loadHistory() {
  chrome.storage.local.get(['browseHistory'], (result) => {
    const historyList = document.getElementById('historyList');
    historyList.innerHTML = '';

    let history = result.browseHistory || [];

    // 统一转换为时间戳并排序
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

    // 渲染记录（带调试信息）
    history.forEach(item => {
      const itemDiv = document.createElement('div');
      itemDiv.className = 'history-item';
      // 显示原始时间戳（方便调试）
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
  });
}

// 精确转换时间戳为本地时间（确保时区正确）
function formatLocalTime(timestamp) {
  const date = new Date(timestamp);
  
  // 手动拼接本地时间（避免toLocaleString的浏览器差异）
  const year = date.getFullYear();
  const month = padZero(date.getMonth() + 1); // 月份0-11，需+1
  const day = padZero(date.getDate());
  const hours = padZero(date.getHours()); // 24小时制
  const minutes = padZero(date.getMinutes());
  const seconds = padZero(date.getSeconds());
  
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

// 数字补零（确保格式统一）
function padZero(num) {
  return num < 10 ? '0' + num : num;
}


// 导出记录（确保导出的数据已排序）
function exportHistory() {
  chrome.storage.local.get(['browseHistory'], (result) => {
    if (chrome.runtime.lastError) {
      alert('导出失败：无法读取数据');
      return;
    }

    let history = result.browseHistory || [];
    // 导出前先统一格式并排序
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
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 100);
  });
}

// 导入记录（强制转换时间格式并排序）
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

        // 处理导入的数据：转换时间戳+去重
        importedData.forEach(item => {
          if (!item.url || !item.title) return; // 跳过无效记录
          // 转换时间格式为时间戳
          const visitedAt = typeof item.visitedAt === 'string' 
            ? new Date(item.visitedAt).getTime() 
            : (typeof item.visitedAt === 'number' ? item.visitedAt : Date.now());
          // 去重
          if (!history.some(h => h.url === item.url)) {
            history.push({ ...item, visitedAt });
          }
        });

        // 统一排序后保存
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