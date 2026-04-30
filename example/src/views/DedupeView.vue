<script setup lang="ts">
import { ref, reactive, computed, onUnmounted } from 'vue';
import { ElMessage } from 'element-plus';
import { api } from '../utils/request';

const logs = ref<Array<{ time: string; message: string; type: 'info' | 'success' | 'warning' | 'error' }>>([]);
const requestCount = ref(0);
const successCount = ref(0);
const dedupeCount = ref(0);
const isLoading = ref(false);

// 配置 - 支持所有快捷配置方式
const config = reactive({
  // 启用状态
  enabled: true,

  // 快捷配置方式选择
  configMode: 'object' as 'boolean' | 'number' | 'string' | 'function' | 'object',

  // 对象配置
  dedupeConfig: {
    enabled: true,
    timeWindow: 1000,
  },

  // 数字配置（timeWindow ms）
  timeWindow: 1000,

  // 字符串配置（requestKey 模板）
  requestKeyTemplate: 'method:url',

  // 函数配置（自定义 key 生成）
  customKeyFunction: 'method:url:params',

  // 搜索关键词
  searchKeyword: 'test',
});

const addLog = (message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
  const now = new Date();
  const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
  logs.value.unshift({ time, message, type });
  if (logs.value.length > 100) logs.value.pop();
};

// 获取当前 dedupe 配置
const getDedupeConfig = () => {
  switch (config.configMode) {
    case 'boolean':
      return config.enabled;
    case 'number':
      return config.timeWindow;
    case 'string':
      return config.requestKeyTemplate;
    case 'function':
      return (config: any) => {
        const method = config.method?.toUpperCase() || 'GET';
        const url = config.url || '';
        const params = JSON.stringify(config.params || {});
        return `${method}:${url}:${params}`;
      };
    case 'object':
    default:
      return config.dedupeConfig;
  }
};

// 测试 1: 连续快速点击（触发去重）
const testRapidClick = async () => {
  requestCount.value++;
  addLog(`[测试1] 连续快速点击 - 第 ${requestCount.value} 次请求`, 'info');

  try {
    const result = await api.post('/api/submit', {
      data: { keyword: config.searchKeyword, timestamp: Date.now() },
      dedupe: getDedupeConfig(),
    });
    successCount.value++;
    addLog(`请求成功: ${JSON.stringify(result)}`, 'success');
  } catch (error: any) {
    if (error.message?.includes('cancel') || error.message?.includes('aborted')) {
      dedupeCount.value++;
      addLog(`请求被去重取消: ${error.message}`, 'warning');
      ElMessage.warning('请求被去重');
    } else {
      addLog(`请求失败: ${error.message}`, 'error');
    }
  }
};

// 测试 2: 搜索防抖（多次快速搜索）
const testSearchDebounce = async () => {
  addLog('[测试2] 搜索防抖测试 - 模拟用户快速输入', 'info');

  const keywords = ['apple', 'banana', 'cherry', 'date', 'elderberry'];

  for (let i = 0; i < keywords.length; i++) {
    setTimeout(() => {
      requestCount.value++;
      addLog(`搜索: "${keywords[i]}"`, 'info');

      api.get('/api/search', {
        params: { q: keywords[i] },
        dedupe: getDedupeConfig(),
      })
        .then((result: any) => {
          successCount.value++;
          addLog(`搜索 "${keywords[i]}" 成功: ${result?.data?.results?.length || 0} 条结果`, 'success');
        })
        .catch((error: any) => {
          if (error.message?.includes('cancel') || error.message?.includes('aborted')) {
            dedupeCount.value++;
            addLog(`搜索被去重`, 'warning');
          } else {
            addLog(`搜索失败: ${error.message}`, 'error');
          }
        });
    }, i * 200);
  }
};

// 测试 3: 表单重复提交（多次点击提交按钮）
const testFormSubmit = async () => {
  addLog('[测试3] 表单重复提交测试', 'info');

  const submitCount = 5;
  for (let i = 0; i < submitCount; i++) {
    setTimeout(() => {
      requestCount.value++;
      addLog(`提交表单 #${i + 1}`, 'info');

      api.post('/api/submit', {
        data: { formId: 'test-form', submitTime: Date.now() },
        dedupe: getDedupeConfig(),
      })
        .then((result: any) => {
          successCount.value++;
          addLog(`提交成功 #${i + 1}`, 'success');
          ElMessage.success(`提交成功 #${i + 1}`);
        })
        .catch((error: any) => {
          if (error.message?.includes('cancel') || error.message?.includes('aborted')) {
            dedupeCount.value++;
            addLog(`重复提交被拦截 #${i + 1}`, 'warning');
            ElMessage.warning(`重复提交被拦截 #${i + 1}`);
          } else {
            addLog(`提交失败: ${error.message}`, 'error');
          }
        });
    }, i * 300);
  }
};

// 测试 4: 清除去重状态
const testClearDedupe = async () => {
  addLog('[测试4] 清除去重状态', 'info');

  // 先发起一个请求
  requestCount.value++;
  addLog('发起请求（清除前）...', 'info');

  try {
    await api.post('/api/submit', { data: { test: 1 } }, { dedupe: false });
    successCount.value++;
    addLog('请求成功', 'success');
  } catch (error: any) {
    addLog(`请求失败: ${error.message}`, 'error');
  }

  // 等待一段时间让缓存过期
  await new Promise(resolve => setTimeout(resolve, 1500));
  addLog('去重缓存已过期（1.5s）', 'info');

  // 再发起相同请求
  requestCount.value++;
  addLog('发起相同请求（清除后）...', 'info');

  try {
    await api.post('/api/submit', { data: { test: 1 } }, { dedupe: config.dedupeConfig });
    successCount.value++;
    addLog('请求成功（独立请求）', 'success');
    ElMessage.success('独立请求成功，证明缓存已清除');
  } catch (error: any) {
    if (error.message?.includes('cancel') || error.message?.includes('aborted')) {
      dedupeCount.value++;
      addLog(`请求被去重`, 'warning');
    } else {
      addLog(`请求失败: ${error.message}`, 'error');
    }
  }
};

// 获取配置说明
const configModeDescription = computed(() => {
  const descriptions = {
    boolean: 'boolean: true/false，仅控制开关',
    number: 'number: 时间窗口毫秒数，1000 = 1秒内去重',
    string: 'string: requestKey 模板字符串',
    function: 'function: 自定义 key 生成函数',
    object: 'object: 完整配置对象 { enabled, timeWindow, requestKey }',
  };
  return descriptions[config.configMode];
});

// 统计数据
const stats = computed(() => ({
  requestCount: requestCount.value,
  successCount: successCount.value,
  dedupeCount: dedupeCount.value,
  dedupeRate: requestCount.value > 0
    ? Math.round((dedupeCount.value / requestCount.value) * 100)
    : 0,
}));

const clearLogs = () => {
  logs.value = [];
  addLog('日志已清除', 'info');
};

const resetStats = () => {
  requestCount.value = 0;
  successCount.value = 0;
  dedupeCount.value = 0;
  addLog('统计数据已重置', 'info');
};

onUnmounted(() => {
  // 清理
});
</script>

<template>
  <div class="max-w-5xl mx-auto">
    <h2 class="text-2xl font-bold mb-2 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
      防重复提交管理器测试
    </h2>

    <p class="text-light/60 mb-6">
      测试防重复提交管理器的各种配置方式和去重行为
    </p>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- 配置面板 -->
      <div class="card-glow">
        <div class="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500 to-teal-500 flex items-center justify-center mb-4">
          <span class="text-white text-lg">⚙️</span>
        </div>
        <h3 class="text-lg font-semibold mb-4">配置面板</h3>

        <div class="space-y-4">
          <div>
            <label class="block text-xs text-light/50 mb-1">配置方式</label>
            <el-select v-model="config.configMode" class="w-full">
              <el-option value="boolean" label="boolean (true/false)" />
              <el-option value="number" label="number (时间窗口ms)" />
              <el-option value="string" label="string (key模板)" />
              <el-option value="function" label="function (自定义函数)" />
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
              <el-switch v-model="config.dedupeConfig.enabled" />
            </div>
            <label class="block text-xs text-light/50 mb-1">时间窗口 (ms): {{ config.dedupeConfig.timeWindow }}</label>
            <el-slider v-model="config.dedupeConfig.timeWindow" :min="500" :max="5000" :step="100" />
          </div>

          <div v-if="config.configMode === 'number'">
            <label class="block text-xs text-light/50 mb-1">时间窗口 (ms): {{ config.timeWindow }}</label>
            <el-slider v-model="config.timeWindow" :min="500" :max="5000" :step="100" />
          </div>

          <div v-if="config.configMode === 'string'">
            <label class="block text-xs text-light/50 mb-1">Key 模板</label>
            <el-input v-model="config.requestKeyTemplate" size="small" placeholder="method:url" />
            <p class="text-xs text-light/40 mt-1">示例: method:url, method:url:params</p>
          </div>

          <div v-if="config.configMode === 'function'">
            <label class="block text-xs text-light/50 mb-1">自定义 Key 函数</label>
            <el-input v-model="config.customKeyFunction" size="small" readonly />
            <p class="text-xs text-light/40 mt-1">函数: (config) => `${method}:${url}:${params}`</p>
          </div>
        </div>
      </div>

      <!-- 状态显示 -->
      <div class="card-glow">
        <div class="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mb-4">
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
            <span class="text-sm">被去重数</span>
            <el-tag type="warning" size="small">{{ stats.dedupeCount }}</el-tag>
          </div>

          <div class="flex items-center justify-between">
            <span class="text-sm">去重率</span>
            <el-tag type="danger" size="small">{{ stats.dedupeRate }}%</el-tag>
          </div>

          <div class="flex items-center justify-between">
            <span class="text-sm">当前状态</span>
            <el-tag :type="isLoading ? 'warning' : 'success'" size="small">
              {{ isLoading ? '请求中...' : '空闲' }}
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
          <el-button class="w-full" size="small" type="primary" @click="testRapidClick">
            快速点击提交
          </el-button>
          <el-button class="w-full" size="small" type="success" @click="testSearchDebounce">
            搜索防抖
          </el-button>
          <el-button class="w-full" size="small" type="warning" @click="testFormSubmit">
            重复提交表单
          </el-button>
          <el-button class="w-full" size="small" type="info" @click="testClearDedupe">
            测试缓存过期
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
            支持 boolean/number/string/function/object 多种配置方式
          </div>
        </div>
        <div class="p-4 bg-dark/30 rounded-lg">
          <div class="text-2xl mb-2">⏱️</div>
          <div class="text-sm font-medium mb-1">时间窗口</div>
          <div class="text-xs text-light/50">
            在时间窗口内的重复请求会被合并为一个
          </div>
        </div>
        <div class="p-4 bg-dark/30 rounded-lg">
          <div class="text-2xl mb-2">🔑</div>
          <div class="text-sm font-medium mb-1">自定义 Key</div>
          <div class="text-xs text-light/50">
            支持模板字符串或函数自定义请求标识
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
