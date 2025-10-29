/**
 * 内容脚本：在帖子详情页记录最后访问时间，每次访问都发送最新时间
 */

// 检查当前页面是否为帖子详情页（URL包含read.php）
function isPostDetailPage() {
  return window.location.href.includes('read.php');
}

// 提取帖子信息（标题、链接、当前最新时间戳）
function extractPostInfo() {
  // 尝试多种标题选择器（兼容不同页面结构）
  const titleSelectors = [
    '.section-title > [href^="./read.php"]', // 用户提供的主要选择器
    'title',                                 // 页面标题标签
    'h1',                                    // 主标题
    '.post-title',                            // 常见帖子标题类名
    '.thread-title'                           // 备选类名
  ];

  let titleElement = null;
  for (const selector of titleSelectors) {
    titleElement = document.querySelector(selector);
    if (titleElement) break;
  }

  if (!titleElement) {
    console.log('[提取失败] 未找到帖子标题元素');
    return null;
  }

  // 获取当前最新时间（每次访问都重新生成）
  const now = new Date();
  const timestamp = now.getTime(); // 时间戳（毫秒级，唯一且递增）
  const localTimeStr = now.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  // 打印调试信息（方便验证时间是否正确）
  console.log('=== 帖子访问记录 ===');
  console.log('帖子标题：', titleElement.textContent.trim());
  console.log('当前本地时间：', localTimeStr);
  console.log('当前时间戳：', timestamp);
  console.log('====================');

  return {
    title: titleElement.textContent.trim().replace(/\s+/g, ' '), // 清洗标题中的多余空格
    url: window.location.href, // 详情页完整URL（去重依据）
    visitedAt: timestamp // 核心：当前访问的时间戳
  };
}

// 在详情页完全加载后记录访问时间
function recordLastVisitTime() {
  // 等待页面所有资源加载完成（确保标题元素已渲染）
  if (document.readyState === 'complete') {
    sendVisitRecord();
  } else {
    window.addEventListener('load', sendVisitRecord);
  }

  // 发送记录到background.js
  function sendVisitRecord() {
    if (!isPostDetailPage()) return;

    const postInfo = extractPostInfo();
    if (postInfo) {
      chrome.runtime.sendMessage({
        action: 'savePosts',
        posts: [postInfo] // 每次只发送当前帖子的信息
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.log('[发送失败]', chrome.runtime.lastError);
        } else if (response) {
          if (response.updated > 0) {
            console.log(`[更新成功] 已更新最后访问时间：${new Date(postInfo.visitedAt).toLocaleString()}`);
          } else if (response.added > 0) {
            console.log(`[新增成功] 首次访问记录：${new Date(postInfo.visitedAt).toLocaleString()}`);
          }
        }
      });
    }
  }
}

// 监听列表页的帖子点击（预记录时间，进入详情页后会更新）
function listenPostClicks() {
  if (isPostDetailPage()) return;

  document.addEventListener('click', (e) => {
    const postLink = e.target.closest('[href^="./read.php"]');
    if (postLink) {
      const now = new Date();
      const preRecord = {
        title: postLink.textContent.trim().replace(/\s+/g, ' '),
        url: new URL(postLink.href, window.location.origin).href,
        visitedAt: now.getTime()
      };
      // 预发送记录（进入详情页后会被最新时间覆盖）
      chrome.runtime.sendMessage({ action: 'savePosts', posts: [preRecord] });
    }
  });
}

// 初始化脚本（根据页面类型执行对应逻辑）
function init() {
  if (isPostDetailPage()) {
    recordLastVisitTime(); // 详情页：记录最后访问时间
  } else {
    listenPostClicks();    // 列表页：监听点击预记录
  }
}

// 启动执行
init();