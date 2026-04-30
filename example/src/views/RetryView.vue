<script setup lang="ts">
import { ref, reactive, computed, onUnmounted } from 'vue';
import { ElMessage } from 'element-plus';
import { api } from '../utils/request';

const logs = ref<Array<{ time: string; message: string; type: 'info' | 'success' | 'warning' | 'error' }>>([]);
const requestCount = ref(0);
const successCount = ref(0);
const failCount = ref(0);
const pendingRequests = ref(0);

// 配置 - 支持所有快捷配置方式
const config = reactive({
  // 启用状态
  enabled: true,

  // 快捷配置方式选择
  configMode: 'object' as 'boolean' | 'number' | 'function' | 'object',

  // 对象配置
  retryConfig: {
    enabled: true,
    maxRetries: 3,
    retryDelay: 500,
    exponentialBackoff: false,
    retryMethods: ['GET', 'POST', 'PUT', 'DELETE'],
    retryStatusCodes: [408, 429, 500, 502, 503, 504],
    shouldRetry: undefined as ((error: any) => boolean) | undefined,
  },

  // 数字配置（maxRetries）
  maxRetries: 3,

  // 函数配置（shouldRetry）
  shouldRetryFn: (error: any) => {
    // 只在网络错误或 5xx 错误时重试
    return !error.response || error.response.status >= 500;
  },

  // 是否模拟失败
  simulateFailure: true,
});

const addLog = (message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
  const now = new Date();
  const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
  logs.value.unshift({ time, message, type });
  if (logs.value.length > 100) logs.value.pop();
};

// 获取当前 retry 配置
const getRetryConfig = () => {
  switch (config.configMode) {
    case 'boolean':
      return config.enabled;
    case 'number':
      return config.maxRetries;
    case 'function':
      return config.shouldRetryFn;
    case 'object':
    default:
      return {
        ...config.retryConfig,
        shouldRetry: config.retryConfig.shouldRetry,
      };
  }
};

// 测试 1: 自动重试失败请求
const testAutoRetry = async () => {
  pendingRequests.value++;
  requestCount.value++;
  addLog('[测试1] 自动重试失败请求', 'info');

  try {
    const result = await api.get('/api/flaky', {
      retry: getRetryConfig(),
    });
    successCount.value++;
    addLog(`请求成功: ${JSON.stringify(result)}`, 'success');
    ElMessage.success('请求成功（经过重试）');
  } catch (error: any) {
    failCount.value++;
    addLog(`请求最终失败: ${error.message}`, 'error');
    ElMessage.error('请求失败');
  } finally {
    pendingRequests.value--;
  }
};

// 测试 2: 指数退避
const testExponentialBackoff = async () => {
  pendingRequests.value++;
  requestCount.value++;
  addLog('[测试2] 指数退避重试', 'info');

  // 开启指数退避
  const retryConfig = {
    enabled: true,
    maxRetries: 4,
    retryDelay: 500,
    exponentialBackoff: true,
  };

  addLog('配置: maxRetries=4, baseDelay=500ms, exponentialBackoff=true', 'info');
  addLog('预期延迟序列: 500ms, 1000ms, 2000ms, 4000ms...', 'info');

  try {
    const result = await api.get('/api/flaky', { retry: retryConfig });
    successCount.value++;
    addLog(`请求成功（指数退避）: ${JSON.stringify(result)}`, 'success');
    ElMessage.success('指数退避重试成功');
  } catch (error: any) {
    failCount.value++;
    addLog(`请求失败: ${error.message}`, 'error');
    ElMessage.error('请求失败');
  } finally {
    pendingRequests.value--;
  }
};

// 测试 3: 自定义重试条件
const testCustomRetryCondition = async () => {
  pendingRequests.value++;
  requestCount.value++;
  addLog('[测试3] 自定义重试条件', 'info');

  // 只在网络错误时重试，不重试业务错误
  const customShouldRetry = (error: any) => {
    // 无响应（网络错误）时重试
    if (!error.response) {
      addLog('检测到网络错误，准备重试...', 'warning');
      return true;
    }
    // 4xx 客户端错误不重试
    if (error.response.status >= 400 && error.response.status < 500) {
      addLog(`客户端错误 ${error.response.status}，不重试`, 'warning');
      return false;
    }
    // 5xx 服务器错误重试
    if (error.response.status >= 500) {
      addLog(`服务器错误 ${error.response.status}，准备重试...`, 'warning');
      return true;
    }
    return false;
  };

  try {
    const result = await api.get('/api/users', {
      retry: {
        enabled: true,
        maxRetries: 3,
        shouldRetry: customShouldRetry,
      },
    });
    successCount.value++;
    addLog(`请求成功: ${JSON.stringify(result)}`, 'success');
  } catch (error: any) {
    failCount.value++;
    if (error.response?.status === 401) {
      addLog('401 错误（自定义条件判定不重试）', 'warning');
    } else {
      addLog(`请求失败: ${error.message}`, 'error');
    }
  } finally {
    pendingRequests.value--;
  }
};

// 测试 4: 禁用重试
const testDisabledRetry = async () => {
  pendingRequests.value++;
  requestCount.value++;
  addLog('[测试4] 禁用重试功能', 'info');

  try {
    const result = await api.get('/api/flaky', { retry: false });
    successCount.value++;
    addLog(`请求成功: ${JSON.stringify(result)}`, 'success');
  } catch (error: any) {
    failCount.value++;
    addLog(`请求立即失败（无重试）: ${error.message}`, 'error');
    ElMessage.error('禁用重试，请求立即失败');
  } finally {
    pendingRequests.value--;
  }
};

// 测试 5: 固定延迟重试
const testFixedDelayRetry = async () => {
  pendingRequests.value++;
  requestCount.value++;
  addLog('[测试5] 固定延迟重试', 'info');

  const retryConfig = {
    enabled: true,
    maxRetries: 3,
    retryDelay: 1000, // 固定 1 秒延迟
    exponentialBackoff: false,
  };

  addLog('配置: maxRetries=3, retryDelay=1000ms, exponentialBackoff=false', 'info');
  addLog('预期延迟序列: 1000ms, 1000ms, 1000ms', 'info');

  try {
    const result = await api.get('/api/flaky', { retry: retryConfig });
    successCount.value++;
    addLog(`请求成功（固定延迟）: ${JSON.stringify(result)}`, 'success');
    ElMessage.success('固定延迟重试成功');
  } catch (error: any) {
    failCount.value++;
    addLog(`请求失败: ${error.message}`, 'error');
    ElMessage.error('请求失败');
  } finally {
    pendingRequests.value--;
  }
};

// 获取配置说明
const configModeDescription = computed(() => {
  const descriptions = {
    boolean: 'boolean: true/false，仅控制开关',
    number: 'number: maxRetries 最大重试次数',
    function: 'function: 自定义 shouldRetry 判断函数',
    object: 'object: 完整配置 { enabled, maxRetries, retryDelay, exponentialBackoff, shouldRetry }',
  };
  return descriptions[config.configMode];
});

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
      失败重试管理器测试
    </h2>

    <p class="text-light/60 mb-6">
      测试失败重试管理器的自动重试、指数退避、自定义重试条件等功能
    </p>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- 配置面板 -->
      <div class="card-glow">
        <div class="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mb-4">
          <span class="text-white text-lg">⚙️</span>
        </div>
        <h3 class="text-lg font-semibold mb-4">配置面板</h3>

        <div class="space-y-4">
          <div>
            <label class="block text-xs text-light/50 mb-1">配置方式</label>
            <el-select v-model="config.configMode" class="w-full">
              <el-option value="boolean" label="boolean (true/false)" />
              <el-option value="number" label="number (maxRetries)" />
              <el-option value="function" label="function (shouldRetry)" />
              <el-option value="object" label="object (完整配置)" />
            </el-select>
            <p class="text-xs text-light/40 mt-1">{{ configModeDescription }}</p>
          </div>

          <div v-if="config.configMode === 'boolean'" class="flex items-center justify-between">
            <span class="text-sm">启用状态</span>
            <el-switch v-model="config.enabled" />
          </div>

          <div v-if="config.configMode === 'object'" class="space-y-3">
            <div class="flex items-center justify-between">
              <span class="text-sm">启用状态</span>
              <el-switch v-model="config.retryConfig.enabled" />
            </div>

            <div>
              <label class="block text-xs text-light/50 mb-1">最大重试次数: {{ config.retryConfig.maxRetries }}</label>
              <el-slider v-model="config.retryConfig.maxRetries" :min="1" :max="10" />
            </div>

            <div>
              <label class="block text-xs text-light/50 mb-1">重试延迟 (ms): {{ config.retryConfig.retryDelay }}</label>
              <el-input-number v-model="config.retryConfig.retryDelay" :min="100" :max="5000" :step="100" size="small" />
            </div>

            <div class="flex items-center justify-between">
              <span class="text-sm">指数退避</span>
              <el-switch v-model="config.retryConfig.exponentialBackoff" />
            </div>
          </div>

          <div v-if="config.configMode === 'number'">
            <label class="block text-xs text-light/50 mb-1">最大重试次数: {{ config.maxRetries }}</label>
            <el-slider v-model="config.maxRetries" :min="1" :max="10" />
          </div>

          <div v-if="config.configMode === 'function'">
            <label class="block text-xs text-light/50 mb-1">自定义 shouldRetry 函数</label>
            <el-input type="textarea" v-model="config.shouldRetryFn" size="small" :rows="3" readonly />
            <p class="text-xs text-light/40 mt-1">返回 true 表示需要重试</p>
          </div>
        </div>
      </div>

      <!-- 状态显示 -->
      <div class="card-glow">
        <div class="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500 to-teal-500 flex items-center justify-center mb-4">
          <span class="text-white text-lg">📊</span>
        </div>
        <h3 class="text-lg font-semibold mb-4">重试统计</h3>

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

      <!-- 快速测试 -->
      <div class="card-glow">
        <div class="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center mb-4">
          <span class="text-white text-lg">🧪</span>
        </div>
        <h3 class="text-lg font-semibold mb-4">快速测试</h3>

        <div class="space-y-2">
          <el-button class="w-full" size="small" type="primary" @click="testAutoRetry">
            自动重试
          </el-button>
          <el-button class="w-full" size="small" type="success" @click="testExponentialBackoff">
            指数退避
          </el-button>
          <el-button class="w-full" size="small" type="warning" @click="testCustomRetryCondition">
            自定义条件
          </el-button>
          <el-button class="w-full" size="small" type="info" @click="testFixedDelayRetry">
            固定延迟
          </el-button>
          <el-button class="w-full" size="small" type="danger" @click="testDisabledRetry">
            禁用重试
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

      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div class="p-4 bg-dark/30 rounded-lg">
          <div class="text-2xl mb-2">🔢</div>
          <div class="text-sm font-medium mb-1">快捷配置</div>
          <div class="text-xs text-light/50">
            支持 boolean/number/function/object 多种配置方式
          </div>
        </div>
        <div class="p-4 bg-dark/30 rounded-lg">
          <div class="text-2xl mb-2">⏱️</div>
          <div class="text-sm font-medium mb-1">重试延迟</div>
          <div class="text-xs text-light/50">
            可设置固定延迟或指数退避策略
          </div>
        </div>
        <div class="p-4 bg-dark/30 rounded-lg">
          <div class="text-2xl mb-2">🎯</div>
          <div class="text-sm font-medium mb-1">自定义条件</div>
          <div class="text-xs text-light/50">
            支持 shouldRetry 函数自定义重试逻辑
          </div>
        </div>
        <div class="p-4 bg-dark/30 rounded-lg">
          <div class="text-2xl mb-2">🔄</div>
          <div class="text-sm font-medium mb-1">自动排队</div>
          <div class="text-xs text-light/50">
            重试期间新请求会排队等待
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
