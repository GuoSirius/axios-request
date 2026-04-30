<script setup lang="ts">
import { ref, reactive, computed } from 'vue';
import { ElMessage } from 'element-plus';
import { api } from '../utils/request';

// 模拟 token 状态
const tokenStatus = ref<'valid' | 'expired' | 'refreshing'>('valid');
const accessToken = ref('test-access-token-123');
const refreshTokenValue = ref('test-refresh-token-456');
const isRefreshing = ref(false);
const pendingRequests = ref(0);
const logs = ref<Array<{ time: string; message: string; type: 'info' | 'success' | 'warning' | 'error' }>>([]);

// 配置
const config = reactive({
  enabled: true,
  whitelistMode: false,
  whitelistUrls: '/api/public,/api/health',
  customHeader: false,
  headerName: 'Authorization',
  headerPrefix: 'Bearer',
  simulateExpired: false,
  businessCodeExpired: false,
  refreshFailed: false,
});

const addLog = (message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
  const now = new Date();
  const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
  logs.value.unshift({ time, message, type });
  if (logs.value.length > 100) logs.value.pop();
};

// 测试普通请求（不需要 token）
const testPublicRequest = async () => {
  addLog('发起公开接口请求（应该跳过 Token）...', 'info');
  try {
    const result = await api.get('/api/public/news', {
      token: false, // 禁用 token
    });
    addLog(`公开接口请求成功: ${JSON.stringify(result)}`, 'success');
  } catch (error: any) {
    addLog(`公开接口请求失败: ${error.message}`, 'error');
  }
};

// 测试白名单请求
const testWhitelistRequest = async () => {
  addLog('发起白名单接口请求...', 'info');
  try {
    const result = await api.get('/api/health', {
      token: {
        whitelistUrls: config.whitelistUrls.split(',').map(s => s.trim()),
      },
    });
    addLog(`白名单请求成功: ${JSON.stringify(result)}`, 'success');
  } catch (error: any) {
    addLog(`白名单请求失败: ${error.message}`, 'error');
  }
};

// 测试普通 API 请求
const testApiRequest = async () => {
  if (!config.enabled) {
    addLog('Token 管理器已禁用，跳过测试', 'warning');
    return;
  }

  pendingRequests.value++;
  addLog(`发起 API 请求（pending: ${pendingRequests.value}）...`, 'info');

  try {
    const result = await api.get('/api/users', {
      token: {
        whitelistUrls: config.whitelistMode ? config.whitelistUrls.split(',').map(s => s.trim()) : [],
      },
    });
    addLog(`API 请求成功: ${JSON.stringify(result)}`, 'success');
  } catch (error: any) {
    addLog(`API 请求失败: ${error.message}`, 'error');
  } finally {
    pendingRequests.value--;
  }
};

// 测试 Token 过期场景
const testExpiredScenario = async () => {
  if (!config.enabled) {
    addLog('Token 管理器已禁用，跳过测试', 'warning');
    return;
  }

  addLog('===== 测试 Token 过期场景 =====', 'warning');
  addLog('模拟 401 响应，触发 Token 刷新...', 'info');

  // 模拟多个并发请求
  for (let i = 1; i <= 3; i++) {
    setTimeout(() => {
      pendingRequests.value++;
      addLog(`并发请求 #${i}（pending: ${pendingRequests.value}）...`, 'info');

      api.get('/api/users', {
        token: {
          whitelistUrls: [],
        },
      }).then(result => {
        addLog(`并发请求 #${i} 成功: ${JSON.stringify(result)}`, 'success');
      }).catch((error: any) => {
        addLog(`并发请求 #${i} 失败: ${error.message}`, 'error');
      }).finally(() => {
        pendingRequests.value--;
      });
    }, i * 100);
  }
};

// 测试刷新失败
const testRefreshFailed = async () => {
  if (!config.enabled) {
    addLog('Token 管理器已禁用，跳过测试', 'warning');
    return;
  }

  addLog('===== 测试刷新失败场景 =====', 'warning');
  addLog('模拟 refresh_token 过期，刷新将失败...', 'info');

  try {
    const result = await api.get('/api/test', {
      token: {
        whitelistUrls: [],
      },
    });
    addLog(`请求成功: ${JSON.stringify(result)}`, 'success');
  } catch (error: any) {
    addLog(`请求失败: ${error.message}`, 'error');
    if (error.message.includes('refresh')) {
      ElMessage.error('Token 刷新失败，需要重新登录');
    }
  }
};

// 手动刷新 Token
const manualRefresh = async () => {
  if (isRefreshing.value) {
    ElMessage.warning('正在刷新中...');
    return;
  }

  addLog('===== 手动刷新 Token =====', 'info');
  isRefreshing.value = true;
  tokenStatus.value = 'refreshing';
  addLog('开始刷新 token...', 'warning');

  // 模拟刷新延迟
  await new Promise(resolve => setTimeout(resolve, 1500));

  accessToken.value = 'new-access-token-' + Date.now().toString(36);
  refreshTokenValue.value = 'new-refresh-token-' + Date.now().toString(36);
  tokenStatus.value = 'valid';
  isRefreshing.value = false;

  addLog('Token 刷新成功', 'success');
  addLog(`新的 access_token: ${accessToken.value.slice(0, 20)}...`, 'info');
  ElMessage.success('Token 刷新成功');
};

// 清除日志
const clearLogs = () => {
  logs.value = [];
  addLog('日志已清除', 'info');
};

// 获取 Token 状态标签类型
const statusType = computed(() => {
  if (isRefreshing.value) return 'warning';
  if (tokenStatus.value === 'valid') return 'success';
  return 'danger';
});

const statusText = computed(() => {
  if (isRefreshing.value) return '刷新中';
  if (tokenStatus.value === 'valid') return '有效';
  return '已过期';
});
</script>

<template>
  <div class="max-w-5xl mx-auto">
    <h2 class="text-2xl font-bold mb-2 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
      Token 管理器测试
    </h2>

    <p class="text-light/60 mb-8">
      测试 Token 管理器的自动刷新、白名单 URL、自定义认证头、三处拦截（请求前、200业务code、401异常）等功能
    </p>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!--- 配置面板 -->
      <div class="card-glow">
        <div class="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center mb-4">
          <span class="text-white text-lg">⚙️</span>
        </div>
        <h3 class="text-lg font-semibold mb-4">配置面板</h3>

        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <span class="text-sm">启用状态</span>
            <el-switch v-model="config.enabled" />
          </div>

          <div class="flex items-center justify-between">
            <span class="text-sm">白名单模式</span>
            <el-switch v-model="config.whitelistMode" />
          </div>

          <div v-if="config.whitelistMode">
            <label class="block text-xs text-light/50 mb-1">白名单 URL</label>
            <el-input
              v-model="config.whitelistUrls"
              placeholder="/api/public,/api/health"
              size="small"
            />
          </div>

          <div class="flex items-center justify-between">
            <span class="text-sm">自定义 Header</span>
            <el-switch v-model="config.customHeader" />
          </div>

          <div v-if="config.customHeader" class="space-y-2">
            <el-input
              v-model="config.headerName"
              placeholder="Header 名称"
              size="small"
            />
            <el-input
              v-model="config.headerPrefix"
              placeholder="前缀（如 Bearer）"
              size="small"
            />
          </div>
        </div>
      </div>

      <!--- 状态显示 -->
      <div class="card-glow">
        <div class="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500 to-teal-500 flex items-center justify-center mb-4">
          <span class="text-white text-lg">📊</span>
        </div>
        <h3 class="text-lg font-semibold mb-4">状态显示</h3>

        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <span class="text-sm">Token 状态</span>
            <el-tag :type="statusType" size="small">{{ statusText }}</el-tag>
          </div>

          <div class="flex items-center justify-between">
            <span class="text-sm">待处理请求</span>
            <el-tag type="info" size="small">{{ pendingRequests }}</el-tag>
          </div>

          <div>
            <label class="block text-xs text-light/50 mb-1">Access Token</label>
            <el-input :value="accessToken" readonly size="small" class="font-mono text-xs" />
          </div>

          <div>
            <label class="block text-xs text-light/50 mb-1">Refresh Token</label>
            <el-input :value="refreshTokenValue" readonly size="small" class="font-mono text-xs" />
          </div>
        </div>
      </div>

      <!--- 快速测试 -->
      <div class="card-glow">
        <div class="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mb-4">
          <span class="text-white text-lg">🚀</span>
        </div>
        <h3 class="text-lg font-semibold mb-4">快速测试</h3>

        <div class="space-y-2">
          <el-button class="w-full" size="small" @click="testPublicRequest">
            公开接口（token: false）
          </el-button>
          <el-button class="w-full" size="small" @click="testWhitelistRequest">
            白名单接口
          </el-button>
          <el-button class="w-full" size="small" type="primary" @click="testApiRequest">
            普通 API 请求
          </el-button>
          <el-button class="w-full" size="small" type="warning" @click="testExpiredScenario">
            测试 401 过期场景
          </el-button>
          <el-button class="w-full" size="small" type="danger" @click="testRefreshFailed">
            测试刷新失败
          </el-button>
        </div>
      </div>
    </div>

    <!--- 完整测试区 -->
    <div class="mt-6 card-glow">
      <div class="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center mb-4">
        <span class="text-white text-lg">🧪</span>
      </div>
      <h3 class="text-lg font-semibold mb-4">完整测试</h3>

      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div class="p-4 bg-dark/30 rounded-lg">
          <div class="text-2xl mb-2">📤</div>
          <div class="text-sm font-medium mb-1">拦截点 A</div>
          <div class="text-xs text-light/50">请求前：检测 token 是否存在</div>
        </div>
        <div class="p-4 bg-dark/30 rounded-lg">
          <div class="text-2xl mb-2">✅</div>
          <div class="text-sm font-medium mb-1">拦截点 B</div>
          <div class="text-xs text-light/50">200 响应：业务 code 过期检测</div>
        </div>
        <div class="p-4 bg-dark/30 rounded-lg">
          <div class="text-2xl mb-2">🔐</div>
          <div class="text-sm font-medium mb-1">拦截点 C</div>
          <div class="text-xs text-light/50">401 异常：token 过期检测</div>
        </div>
        <div class="p-4 bg-dark/30 rounded-lg">
          <div class="text-2xl mb-2">🔄</div>
          <div class="text-sm font-medium mb-1">请求排队</div>
          <div class="text-xs text-light/50">刷新期间自动排队等待</div>
        </div>
      </div>

      <div class="mt-6 flex gap-4 flex-wrap">
        <el-button type="primary" @click="manualRefresh" :loading="isRefreshing" size="large">
          {{ isRefreshing ? '刷新中...' : '手动刷新 Token' }}
        </el-button>
        <el-button type="info" @click="testExpiredScenario" size="large">
          测试并发请求场景
        </el-button>
        <el-button @click="clearLogs" size="large">
          清空日志
        </el-button>
      </div>
    </div>

    <!--- 请求日志 -->
    <div class="mt-6 card-glow">
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
            <span class="text-white text-lg">📝</span>
          </div>
          <div>
            <h3 class="text-lg font-semibold">请求日志</h3>
            <span class="text-xs text-light/40">{{ logs.length }} 条记录</span>
          </div>
        </div>
        <el-button text @click="clearLogs">清空</el-button>
      </div>

      <div class="bg-dark/50 rounded-lg p-4 max-h-80 overflow-y-auto font-mono text-sm">
        <div v-if="logs.length === 0" class="text-center text-light/40 py-8">
          暂无日志，选择上方测试开始
        </div>

        <div
          v-for="(log, index) in logs"
          :key="index"
          class="py-2 border-b border-dark-lighter last:border-0"
          :class="{
            'text-success': log.type === 'success',
            'text-warning': log.type === 'warning',
            'text-error': log.type === 'error',
            'text-light/80': log.type === 'info'
          }"
        >
          <span class="text-primary/60 mr-3">[{{ log.time }}]</span>
          {{ log.message }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
</style>
