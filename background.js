/**
 * 后台逻辑：处理记录存储，支持更新重复帖子的最后访问时间
 */
chrome.runtime.onInstalled.addListener(() => {
  // 初始化存储（首次安装时创建空数组）
  chrome.storage.local.get(['browseHistory'], (result) => {
    if (!result.browseHistory) {
      chrome.storage.local.set({ browseHistory: [] }, () => {
        console.log('存储初始化完成：创建空记录数组');
      });
    }
  });
});

// 监听来自content.js的消息（保存/更新帖子记录）
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // 仅处理保存帖子的请求
  if (message.action === 'savePosts' && message.posts && Array.isArray(message.posts)) {
    chrome.storage.local.get(['browseHistory'], (result) => {
      let history = result.browseHistory || [];
      let addedCount = 0;      // 新增记录数
      let updatedCount = 0;    // 更新记录数（重复帖子）

      // 处理每条待保存的帖子
      message.posts.forEach(newPost => {
        // 验证帖子格式（必须包含url、title、visitedAt）
        if (!newPost.url || !newPost.title || !newPost.visitedAt) {
          console.log('跳过无效记录：', newPost);
          return;
        }

        // 查找是否已存在相同URL的记录（去重依据）
        const existingIndex = history.findIndex(item => item.url === newPost.url);

        if (existingIndex > -1) {
          // 已存在：更新时间戳为最后访问时间
          history[existingIndex].visitedAt = newPost.visitedAt;
          // 同时更新标题（防止帖子标题修改后不同步）
          history[existingIndex].title = newPost.title;
          updatedCount++;
        } else {
          // 不存在：新增记录
          history.push(newPost);
          addedCount++;
        }
      });

      // 按最后访问时间倒序排序（最新的在最前面）
      history.sort((a, b) => b.visitedAt - a.visitedAt);

      // 保存更新后的记录到本地存储
      chrome.storage.local.set({ browseHistory: history }, () => {
        console.log(`处理完成：新增${addedCount}条，更新${updatedCount}条，总记录数${history.length}`);
        // 向content.js返回处理结果
        sendResponse({
          status: 'success',
          added: addedCount,
          updated: updatedCount
        });
      });
    });

    // 表明需要异步发送响应
    return true;
  }
});