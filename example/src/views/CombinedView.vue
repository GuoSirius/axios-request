<script setup lang="ts">
import { ref, reactive, computed, onUnmounted } from 'vue';
import { ElMessage } from 'element-plus';
import { api } from '../utils/request';

const logs = ref<Array<{ time: string; message: string; type: 'info' | 'success' | 'warning' | 'error' }>>([]);
const requestCount = ref(0);
const successCount = ref(0);
const failCount = ref(0);
const pendingRequests = ref(0);

// 配置 - 多管理器协同
const config = reactive({
  token: {
    enabled: true,
    simulateExpired: false,
  },
  retry: {
    enabled: true,
    maxRetries: 3,
    simulateError: false,
  },
  dedupe: {
    enabled: true,
    timeWindow: 1000,
  },
  cancel: {
    enabled: true,
    methods: ['GET'],
  },
});

const addLog = (message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
  const now = new Date();
  const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
  logs.value.unshift({ time, message, type });
  if (logs.value.length > 100) logs.value.pop();
};

// 测试 1: Token + Retry 协同
const testTokenAndRetry = async () => {
  addLog('[测试1] Token + Retry 协同', 'info');

  pendingRequests.value++;
  requestCount.value++;

  try {
    addLog('发起请求 (Token+Retry)...', 'info');
    const result = await api.get('/api/users', {
      token: config.token.enabled ? {} : false,
      retry: config.retry.enabled ? {
        maxRetries: config.retry.maxRetries,
        shouldRetry: (error: any) => {
          // 网络错误或 5xx 错误时重试
          return !error.response || error.response.status >= 500;
        },
      } : false,
    });
    successCount.value++;
    addLog(`请求成功: ${JSON.stringify(result)}`, 'success');
    ElMessage.success('Token + Retry 协同成功');
  } catch (error: any) {
    failCount.value++;
    addLog(`请求失败: ${error.message}`, 'error');
    ElMessage.error('请求失败');
  } finally {
    pendingRequests.value--;
  }
};

// 测试 2: Dedupe + Cancel 协同
const testDedupeAndCancel = async () => {
  addLog('[测试2] Dedupe + Cancel 协同', 'info');

  // 模拟用户快速搜索
  const keywords = ['react', 'vue', 'angular'];
  const requests: Promise<any>[] = [];

  for (let i = 0; i < keywords.length; i++) {
    setTimeout(() => {
      pendingRequests.value++;
      requestCount.value++;
      addLog(`搜索: "${keywords[i]}"`, 'info');

      const requestPromise = api.get('/api/search', {
        params: { q: keywords[i] },
        dedupe: config.dedupe.enabled ? { timeWindow: config.dedupe.timeWindow } : false,
        cancel: config.cancel.enabled ? { methods: config.cancel.methods } : false,
      })
        .then((result: any) => {
          successCount.value++;
          addLog(`搜索 "${keywords[i]}" 成功`, 'success');
        })
        .catch((error: any) => {
          if (error?.message?.includes('Cancel') || error?.code === 'ERR_CANCELED') {
            addLog(`搜索 "${keywords[i]}" 被取消`, 'warning');
          } else if (!error?.message?.includes('cancel')) {
            failCount.value++;
            addLog(`搜索失败: ${error.message}`, 'error');
          }
        })
        .finally(() => {
          pendingRequests.value--;
        });

      requests.push(requestPromise);
    }, i * 400);
  }

  Promise.all(requests).finally(() => {
    addLog(`Dedupe + Cancel 测试完成`, 'info');
  });
};

// 测试 3: Token + Cancel 协同
const testTokenAndCancel = async () => {
  addLog('[测试3] Token + Cancel 协同', 'info');

  // 快速获取用户信息
  const requests: Promise<any>[] = [];
  const requestBatch = 3;

  for (let i = 0; i < requestBatch; i++) {
    setTimeout(() => {
      pendingRequests.value++;
      requestCount.value++;
      addLog(`获取用户 #${i + 1}`, 'info');

      const requestPromise = api.get('/api/users', {
        token: config.token.enabled ? {} : false,
        cancel: config.cancel.enabled ? { methods: config.cancel.methods } : false,
      })
        .then((result: any) => {
          successCount.value++;
          addLog(`用户 #${i + 1} 获取成功`, 'success');
        })
        .catch((error: any) => {
          if (error?.message?.includes('Cancel') || error?.code === 'ERR_CANCELED') {
            addLog(`用户 #${i + 1} 被取消`, 'warning');
          } else if (!error?.message?.includes('cancel')) {
            failCount.value++;
            addLog(`获取失败: ${error.message}`, 'error');
          }
        })
        .finally(() => {
          pendingRequests.value--;
        });

      requests.push(requestPromise);
    }, i * 300);
  }

  Promise.all(requests).finally(() => {
    addLog(`Token + Cancel 测试完成`, 'info');
  });
};

// 测试 4: 四管理器全开
const testAllManagers = async () => {
  addLog('[测试4] 四管理器全开 - 完整协同', 'info');

  // 模拟复杂场景：快速搜索 + token 过期 + 需要重试
  const requests: Promise<any>[] = [];
  const scenarios = [
    { keyword: 'react', priority: 1 },
    { keyword: 'vue', priority: 2 },
    { keyword: 'angular', priority: 3 },
  ];

  for (let i = 0; i < scenarios.length; i++) {
    const { keyword } = scenarios[i];
    setTimeout(() => {
      pendingRequests.value++;
      requestCount.value++;
      addLog(`场景: 搜索 "${keyword}" (Token+Retry+Dedupe+Cancel)`, 'info');

      const requestPromise = api.get('/api/search', {
        params: { q: keyword, timestamp: Date.now() },
        token: config.token.enabled ? {} : false,
        retry: config.retry.enabled ? {
          maxRetries: config.retry.maxRetries,
          shouldRetry: (error: any) => {
            return !error.response || error.response.status >= 500;
          },
        } : false,
        dedupe: config.dedupe.enabled ? { timeWindow: config.dedupe.timeWindow } : false,
        cancel: config.cancel.enabled ? { methods: config.cancel.methods } : false,
      })
        .then((result: any) => {
          successCount.value++;
          addLog(`搜索 "${keyword}" 成功`, 'success');
        })
        .catch((error: any) => {
          if (error?.message?.includes('Cancel') || error?.code === 'ERR_CANCELED') {
            addLog(`搜索 "${keyword}" 被取消`, 'warning');
          } else if (!error?.message?.includes('cancel')) {
            failCount.value++;
            addLog(`搜索 "${keyword}" 失败: ${error.message}`, 'error');
          }
        })
        .finally(() => {
          pendingRequests.value--;
        });

      requests.push(requestPromise);
    }, i * 500);
  }

  Promise.all(requests).finally(() => {
    addLog(`四管理器测试完成 - 成功: ${successCount.value}, 失败: ${failCount.value}`, 'info');
    ElMessage.success('多管理器协同测试完成');
  });
};

// 测试 5: 禁用所有管理器
const testNoManagers = async () => {
  addLog('[测试5] 禁用所有管理器 - 纯净请求', 'info');

  pendingRequests.value++;
  requestCount.value++;

  try {
    const result = await api.get('/api/posts', {
      token: false,
      retry: false,
      dedupe: false,
      cancel: false,
    });
    successCount.value++;
    addLog(`请求成功: ${result?.data?.length || 0} 条数据`, 'success');
    ElMessage.success('纯净请求成功');
  } catch (error: any) {
    failCount.value++;
    addLog(`请求失败: ${error.message}`, 'error');
    ElMessage.error('请求失败');
  } finally {
    pendingRequests.value--;
  }
};

// 测试 6: 连续快速提交
const testRapidSubmit = async () => {
  addLog('[测试6] 连续快速提交表单 (Dedupe+Token)', 'info');

  const requests: Promise<any>[] = [];
  const submitCount = 5;

  for (let i = 0; i < submitCount; i++) {
    setTimeout(() => {
      pendingRequests.value++;
      requestCount.value++;
      addLog(`提交表单 #${i + 1}`, 'info');

      const requestPromise = api.post('/api/submit', {
        data: {
          formId: 'rapid-form',
          submitTime: Date.now(),
          index: i,
        },
        token: config.token.enabled ? {} : false,
        dedupe: config.dedupe.enabled ? { timeWindow: config.dedupe.timeWindow } : false,
      })
        .then((result: any) => {
          successCount.value++;
          addLog(`表单 #${i + 1} 提交成功`, 'success');
        })
        .catch((error: any) => {
          if (error?.message?.includes('Cancel') || error?.code === 'ERR_CANCELED') {
            addLog(`表单 #${i + 1} 被取消/去重`, 'warning');
          } else if (!error?.message?.includes('cancel')) {
            failCount.value++;
            addLog(`提交 #${i + 1} 失败: ${error.message}`, 'error');
          }
        })
        .finally(() => {
          pendingRequests.value--;
        });

      requests.push(requestPromise);
    }, i * 200);
  }

  Promise.all(requests).finally(() => {
    addLog(`快速提交测试完成`, 'info');
  });
};

// 统计数据
const stats = computed(() => ({
  requestCount: requestCount.value,
  successCount: successCount.value,
  failCount: failCount.value,
  pendingRequests: pendingRequests.value,
  successRate: requestCount.value > 0
    ? Math.round((successCount.value / requestCount.value) * 100)
    : 0,
}));

const clearLogs = () => {
  logs.value = [];
  addLog('日志已清除', 'info');
};

const resetStats = () => {
  requestCount.value = 0;
  successCount.value = 0;
  failCount.value = 0;
  pendingRequests.value = 0;
  addLog('统计数据已重置', 'info');
};

onUnmounted(() => {
  // 清理
});
</script>

<template>
  <div class="max-w-5xl mx-auto">
    <h2 class="text-2xl font-bold mb-2 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
      多管理器协同测试
    </h2>

    <p class="text-light/60 mb-6">
      测试多个管理器同时工作的协同效果，包括 Token、Retry、Dedupe、Cancel 的组合使用
    </p>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- 管理器配置 -->
      <div class="card-glow">
        <div class="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center mb-4">
          <span class="text-white text-lg">⚙️</span>
        </div>
        <h3 class="text-lg font-semibold mb-4">管理器配置</h3>

        <div class="space-y-4">
          <!-- Token 管理器 -->
          <div class="p-4 bg-dark/30 rounded-lg">
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-2">
                <span class="text-blue-400">🔑</span>
                <span class="text-sm font-medium">Token 管理器</span>
              </div>
              <el-switch v-model="config.token.enabled" />
            </div>
            <div class="flex items-center justify-between text-xs text-light/50">
              <span>自动刷新 / 白名单 / 自定义 Header</span>
            </div>
          </div>

          <!-- Retry 管理器 -->
          <div class="p-4 bg-dark/30 rounded-lg">
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-2">
                <span class="text-purple-400">🔄</span>
                <span class="text-sm font-medium">重试管理器</span>
              </div>
              <el-switch v-model="config.retry.enabled" />
            </div>
            <div v-if="config.retry.enabled" class="mt-2">
              <label class="text-xs text-light/50">最大重试: {{ config.retry.maxRetries }}</label>
              <el-slider v-model="config.retry.maxRetries" :min="1" :max="5" size="small" />
            </div>
          </div>

          <!-- Dedupe 管理器 -->
          <div class="p-4 bg-dark/30 rounded-lg">
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-2">
                <span class="text-green-400">📑</span>
                <span class="text-sm font-medium">防重复提交</span>
              </div>
              <el-switch v-model="config.dedupe.enabled" />
            </div>
            <div v-if="config.dedupe.enabled" class="mt-2">
              <label class="text-xs text-light/50">时间窗口: {{ config.dedupe.timeWindow }}ms</label>
              <el-slider v-model="config.dedupe.timeWindow" :min="500" :max="3000" :step="100" size="small" />
            </div>
          </div>

          <!-- Cancel 管理器 -->
          <div class="p-4 bg-dark/30 rounded-lg">
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-2">
                <span class="text-orange-400">🚫</span>
                <span class="text-sm font-medium">取消请求</span>
              </div>
              <el-switch v-model="config.cancel.enabled" />
            </div>
            <div v-if="config.cancel.enabled" class="mt-2">
              <el-select v-model="config.cancel.methods" multiple size="small" placeholder="选择方法">
                <el-option value="GET" label="GET" />
                <el-option value="POST" label="POST" />
                <el-option value="PUT" label="PUT" />
                <el-option value="DELETE" label="DELETE" />
              </el-select>
            </div>
          </div>
        </div>
      </div>

      <!-- 状态统计 -->
      <div class="card-glow">
        <div class="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center mb-4">
          <span class="text-white text-lg">📊</span>
        </div>
        <h3 class="text-lg font-semibold mb-4">请求统计</h3>

        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <span class="text-sm">总请求数</span>
            <el-tag type="info" size="small">{{ stats.requestCount }}</el-tag>
          </div>

          <div class="flex items-center justify-between">
            <span class="text-sm">成功数</span>
            <el-tag type="success" size="small">{{ stats.successCount }}</el-tag>
          </div>

          <div class="flex items-center justify-between">
            <span class="text-sm">失败数</span>
            <el-tag type="danger" size="small">{{ stats.failCount }}</el-tag>
          </div>

          <div class="flex items-center justify-between">
            <span class="text-sm">成功率</span>
            <el-tag type="primary" size="small">{{ stats.successRate }}%</el-tag>
          </div>

          <div class="flex items-center justify-between">
            <span class="text-sm">待处理</span>
            <el-tag :type="stats.pendingRequests > 0 ? 'warning' : 'success'" size="small">
              {{ stats.pendingRequests }}
            </el-tag>
          </div>
        </div>
      </div>
    </div>

    <!-- 测试场景 -->
    <div class="mt-6 card-glow">
      <div class="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center mb-4">
        <span class="text-white text-lg">🧪</span>
      </div>
      <h3 class="text-lg font-semibold mb-4">协同测试场景</h3>

      <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
        <el-button type="primary" @click="testTokenAndRetry" size="large" class="h-auto py-3">
          <div class="text-center">
            <div class="text-lg mb-1">🔑 + 🔄</div>
            <div class="text-xs">Token + Retry</div>
          </div>
        </el-button>

        <el-button type="success" @click="testDedupeAndCancel" size="large" class="h-auto py-3">
          <div class="text-center">
            <div class="text-lg mb-1">📑 + 🚫</div>
            <div class="text-xs">Dedupe + Cancel</div>
          </div>
        </el-button>

        <el-button type="warning" @click="testTokenAndCancel" size="large" class="h-auto py-3">
          <div class="text-center">
            <div class="text-lg mb-1">🔑 + 🚫</div>
            <div class="text-xs">Token + Cancel</div>
          </div>
        </el-button>

        <el-button type="danger" @click="testAllManagers" size="large" class="h-auto py-3">
          <div class="text-center">
            <div class="text-lg mb-1">🔑🔄📑🚫</div>
            <div class="text-xs">四管理器全开</div>
          </div>
        </el-button>

        <el-button type="info" @click="testNoManagers" size="large" class="h-auto py-3">
          <div class="text-center">
            <div class="text-lg mb-1">∅</div>
            <div class="text-xs">禁用所有</div>
          </div>
        </el-button>

        <el-button type="default" @click="testRapidSubmit" size="large" class="h-auto py-3">
          <div class="text-center">
            <div class="text-lg mb-1">📤</div>
            <div class="text-xs">快速提交</div>
          </div>
        </el-button>
      </div>

      <div class="mt-4 flex gap-4 flex-wrap">
        <el-button @click="resetStats" size="large">
          重置统计
        </el-button>
        <el-button @click="clearLogs" size="large">
          清空日志
        </el-button>
      </div>
    </div>

    <!-- 请求日志 -->
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
