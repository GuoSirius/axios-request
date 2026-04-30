<script setup lang="ts">
import { ref, reactive, computed, onUnmounted } from 'vue';
import { ElMessage } from 'element-plus';
import { api } from '../utils/request';

const logs = ref<Array<{ time: string; message: string; type: 'info' | 'success' | 'warning' | 'error' }>>([]);
const requestCount = ref(0);
const successCount = ref(0);
const cancelledCount = ref(0);
const pendingRequests = ref(0);

// 配置 - 支持所有快捷配置方式
const config = reactive({
  // 启用状态
  enabled: true,

  // 快捷配置方式选择
  configMode: 'object' as 'boolean' | 'string' | 'array' | 'object',

  // 对象配置
  cancelConfig: {
    enabled: true,
    methods: ['GET'],
  },

  // 字符串配置（methods）
  methodsString: 'GET,POST',

  // 数组配置（methods）
  methodsArray: ['GET', 'POST'],

  // 搜索关键词
  searchKeyword: 'test',
});

const addLog = (message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
  const now = new Date();
  const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
  logs.value.unshift({ time, message, type });
  if (logs.value.length > 100) logs.value.pop();
};

// 获取当前 cancel 配置
const getCancelConfig = () => {
  switch (config.configMode) {
    case 'boolean':
      return config.enabled;
    case 'string':
      return config.methodsString.split(',').map(m => m.trim());
    case 'array':
      return config.methodsArray;
    case 'object':
    default:
      return config.cancelConfig;
  }
};

// 测试 1: 搜索框防抖（快速搜索自动取消旧请求）
const testSearchDebounce = async () => {
  addLog('[测试1] 搜索框防抖 - 快速输入多个关键词', 'info');

  const keywords = ['react', 'vue', 'angular', 'svelte', 'ember'];
  const requests: Promise<any>[] = [];

  for (let i = 0; i < keywords.length; i++) {
    setTimeout(() => {
      pendingRequests.value++;
      requestCount.value++;
      addLog(`搜索: "${keywords[i]}"（请求 #${requestCount.value}）`, 'info');

      const requestPromise = api.get('/api/search', {
        params: { q: keywords[i] },
        cancel: getCancelConfig(),
      })
        .then((result: any) => {
          successCount.value++;
          addLog(`搜索 "${keywords[i]}" 成功: ${result?.data?.results?.length || 0} 条结果`, 'success');
        })
        .catch((error: any) => {
          if (error?.message?.includes('Cancel') || error?.message?.includes('canceled') || error?.code === 'ERR_CANCELED') {
            cancelledCount.value++;
            addLog(`搜索 "${keywords[i]}" 被取消`, 'warning');
          } else if (!error?.message?.includes('cancel')) {
            addLog(`搜索失败: ${error.message}`, 'error');
          }
        })
        .finally(() => {
          pendingRequests.value--;
        });

      requests.push(requestPromise);
    }, i * 400);
  }

  // 等待所有请求完成
  Promise.all(requests).finally(() => {
    addLog(`搜索测试完成 - 成功: ${successCount.value}, 取消: ${cancelledCount.value}`, 'info');
  });
};

// 测试 2: GET 请求取消（适用列表刷新）
const testGetRequestCancel = async () => {
  addLog('[测试2] GET 请求取消 - 快速刷新列表', 'info');

  const requests: Promise<any>[] = [];
  const requestBatch = 5;

  for (let i = 0; i < requestBatch; i++) {
    setTimeout(() => {
      pendingRequests.value++;
      requestCount.value++;
      addLog(`刷新列表 #${i + 1}（请求 #${requestCount.value}）`, 'info');

      const requestPromise = api.get('/api/posts', {
        cancel: getCancelConfig(),
      })
        .then((result: any) => {
          successCount.value++;
          addLog(`列表 #${i + 1} 加载成功: ${result?.data?.length || 0} 条`, 'success');
        })
        .catch((error: any) => {
          if (error?.message?.includes('Cancel') || error?.message?.includes('canceled') || error?.code === 'ERR_CANCELED') {
            cancelledCount.value++;
            addLog(`列表 #${i + 1} 被取消`, 'warning');
          } else if (!error?.message?.includes('cancel')) {
            addLog(`加载失败: ${error.message}`, 'error');
          }
        })
        .finally(() => {
          pendingRequests.value--;
        });

      requests.push(requestPromise);
    }, i * 300);
  }

  Promise.all(requests).finally(() => {
    addLog(`GET 请求测试完成 - 成功: ${successCount.value}, 取消: ${cancelledCount.value}`, 'info');
  });
};

// 测试 3: POST 请求取消（适用表单提交）
const testPostRequestCancel = async () => {
  if (!config.methodsArray.includes('POST') && config.configMode !== 'string') {
    addLog('当前配置不支持取消 POST 请求', 'warning');
    ElMessage.warning('请在配置中启用 POST 方法');
    return;
  }

  addLog('[测试3] POST 请求取消 - 快速提交多个表单', 'info');

  const requests: Promise<any>[] = [];
  const requestBatch = 4;

  for (let i = 0; i < requestBatch; i++) {
    setTimeout(() => {
      pendingRequests.value++;
      requestCount.value++;
      addLog(`提交表单 #${i + 1}（请求 #${requestCount.value}）`, 'info');

      const requestPromise = api.post('/api/submit', {
        data: { formId: `form-${i}`, timestamp: Date.now() },
        cancel: getCancelConfig(),
      })
        .then((result: any) => {
          successCount.value++;
          addLog(`表单 #${i + 1} 提交成功`, 'success');
          ElMessage.success(`表单 #${i + 1} 提交成功`);
        })
        .catch((error: any) => {
          if (error?.message?.includes('Cancel') || error?.message?.includes('canceled') || error?.code === 'ERR_CANCELED') {
            cancelledCount.value++;
            addLog(`表单 #${i + 1} 被取消`, 'warning');
          } else if (!error?.message?.includes('cancel')) {
            addLog(`提交失败: ${error.message}`, 'error');
          }
        })
        .finally(() => {
          pendingRequests.value--;
        });

      requests.push(requestPromise);
    }, i * 350);
  }

  Promise.all(requests).finally(() => {
    addLog(`POST 请求测试完成 - 成功: ${successCount.value}, 取消: ${cancelledCount.value}`, 'info');
  });
};

// 测试 4: 禁用取消功能
const testDisabledCancel = async () => {
  addLog('[测试4] 禁用取消功能 - 所有请求都会执行', 'info');

  const requests: Promise<any>[] = [];
  const requestBatch = 3;

  for (let i = 0; i < requestBatch; i++) {
    setTimeout(() => {
      pendingRequests.value++;
      requestCount.value++;
      addLog(`请求 #${i + 1}（禁用取消）`, 'info');

      const requestPromise = api.get('/api/posts', {
        cancel: false, // 禁用取消
      })
        .then((result: any) => {
          successCount.value++;
          addLog(`请求 #${i + 1} 成功: ${result?.data?.length || 0} 条`, 'success');
        })
        .catch((error: any) => {
          if (!error?.message?.includes('cancel')) {
            addLog(`请求 #${i + 1} 失败: ${error.message}`, 'error');
          }
        })
        .finally(() => {
          pendingRequests.value--;
        });

      requests.push(requestPromise);
    }, i * 300);
  }

  Promise.all(requests).finally(() => {
    addLog(`禁用取消测试完成 - 成功: ${successCount.value}, 取消: ${cancelledCount.value}`, 'info');
  });
};

// 获取配置说明
const configModeDescription = computed(() => {
  const descriptions = {
    boolean: 'boolean: true/false，仅控制开关',
    string: 'string: 方法列表逗号分隔，如 "GET,POST"',
    array: 'array: 方法数组，如 ["GET", "POST"]',
    object: 'object: 完整配置 { enabled, methods }',
  };
  return descriptions[config.configMode];
});

// 统计数据
const stats = computed(() => ({
  requestCount: requestCount.value,
  successCount: successCount.value,
  cancelledCount: cancelledCount.value,
  pendingRequests: pendingRequests.value,
  cancelRate: requestCount.value > 0
    ? Math.round((cancelledCount.value / requestCount.value) * 100)
    : 0,
}));

const clearLogs = () => {
  logs.value = [];
  addLog('日志已清除', 'info');
};

const resetStats = () => {
  requestCount.value = 0;
  successCount.value = 0;
  cancelledCount.value = 0;
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
      取消请求管理器测试
    </h2>

    <p class="text-light/60 mb-6">
      测试取消请求管理器的自动取消、自定义方法等功能
    </p>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- 配置面板 -->
      <div class="card-glow">
        <div class="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center mb-4">
          <span class="text-white text-lg">⚙️</span>
        </div>
        <h3 class="text-lg font-semibold mb-4">配置面板</h3>

        <div class="space-y-4">
          <div>
            <label class="block text-xs text-light/50 mb-1">配置方式</label>
            <el-select v-model="config.configMode" class="w-full">
              <el-option value="boolean" label="boolean (true/false)" />
              <el-option value="string" label="string (方法列表)" />
              <el-option value="array" label="array (方法数组)" />
              <el-option value="object" label="object (完整配置)" />
            </el-select>
            <p class="text-xs text-light/40 mt-1">{{ configModeDescription }}</p>
          </div>

          <div v-if="config.configMode === 'boolean'" class="flex items-center justify-between">
            <span class="text-sm">启用状态</span>
            <el-switch v-model="config.enabled" />
          </div>

          <div v-if="config.configMode === 'object'">
            <div class="flex items-center justify-between mb-2">
              <span class="text-sm">启用状态</span>
              <el-switch v-model="config.cancelConfig.enabled" />
            </div>
            <label class="block text-xs text-light/50 mb-1">HTTP 方法</label>
            <el-select v-model="config.cancelConfig.methods" multiple placeholder="选择方法" class="w-full">
              <el-option value="GET" label="GET" />
              <el-option value="POST" label="POST" />
              <el-option value="PUT" label="PUT" />
              <el-option value="PATCH" label="PATCH" />
              <el-option value="DELETE" label="DELETE" />
            </el-select>
          </div>

          <div v-if="config.configMode === 'string'">
            <label class="block text-xs text-light/50 mb-1">HTTP 方法（逗号分隔）</label>
            <el-input v-model="config.methodsString" size="small" placeholder="GET,POST" />
            <p class="text-xs text-light/40 mt-1">如: GET,POST,PATCH</p>
          </div>

          <div v-if="config.configMode === 'array'">
            <label class="block text-xs text-light/50 mb-1">HTTP 方法</label>
            <el-select v-model="config.methodsArray" multiple placeholder="选择方法" class="w-full">
              <el-option value="GET" label="GET" />
              <el-option value="POST" label="POST" />
              <el-option value="PUT" label="PUT" />
              <el-option value="PATCH" label="PATCH" />
              <el-option value="DELETE" label="DELETE" />
            </el-select>
          </div>
        </div>
      </div>

      <!-- 状态显示 -->
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
            <span class="text-sm">被取消数</span>
            <el-tag type="warning" size="small">{{ stats.cancelledCount }}</el-tag>
          </div>

          <div class="flex items-center justify-between">
            <span class="text-sm">取消率</span>
            <el-tag type="danger" size="small">{{ stats.cancelRate }}%</el-tag>
          </div>

          <div class="flex items-center justify-between">
            <span class="text-sm">待处理</span>
            <el-tag :type="stats.pendingRequests > 0 ? 'warning' : 'success'" size="small">
              {{ stats.pendingRequests }}
            </el-tag>
          </div>
        </div>
      </div>

      <!-- 快速测试 -->
      <div class="card-glow">
        <div class="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mb-4">
          <span class="text-white text-lg">🧪</span>
        </div>
        <h3 class="text-lg font-semibold mb-4">快速测试</h3>

        <div class="space-y-2">
          <el-button class="w-full" size="small" type="primary" @click="testSearchDebounce">
            搜索框防抖
          </el-button>
          <el-button class="w-full" size="small" type="success" @click="testGetRequestCancel">
            GET 请求取消
          </el-button>
          <el-button class="w-full" size="small" type="warning" @click="testPostRequestCancel">
            POST 请求取消
          </el-button>
          <el-button class="w-full" size="small" type="info" @click="testDisabledCancel">
            禁用取消功能
          </el-button>
        </div>
      </div>
    </div>

    <!-- 功能说明 -->
    <div class="mt-6 card-glow">
      <div class="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center mb-4">
        <span class="text-white text-lg">📖</span>
      </div>
      <h3 class="text-lg font-semibold mb-4">功能说明</h3>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="p-4 bg-dark/30 rounded-lg">
          <div class="text-2xl mb-2">🔢</div>
          <div class="text-sm font-medium mb-1">快捷配置</div>
          <div class="text-xs text-light/50">
            支持 boolean/string/array/object 多种配置方式
          </div>
        </div>
        <div class="p-4 bg-dark/30 rounded-lg">
          <div class="text-2xl mb-2">✋</div>
          <div class="text-sm font-medium mb-1">自动取消</div>
          <div class="text-xs text-light/50">
            相同请求自动取消旧请求，适用于搜索防抖等场景
          </div>
        </div>
        <div class="p-4 bg-dark/30 rounded-lg">
          <div class="text-2xl mb-2">⚡</div>
          <div class="text-sm font-medium mb-1">方法过滤</div>
          <div class="text-xs text-light/50">
            可指定只对特定 HTTP 方法启用取消功能
          </div>
        </div>
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
