<script setup lang="ts">
import { ref, reactive, computed } from 'vue';
import { ElMessage } from 'element-plus';
import {
  generateRequestKey,
  createGenerateKey,
  normalizeGenerateKey,
  toFormData,
  checkType,
  flattenFormData,
  deepMerge,
  shallowMerge,
  mergeConfig,
  createConfigMerger,
} from '../../../src';

const logs = ref<Array<{ time: string; message: string; type: 'info' | 'success' | 'warning' | 'error' }>>([]);

// ============================================================
// Request Key 测试配置
// ============================================================
const requestKeyConfig = reactive({
  method: 'GET',
  url: '/api/users',
  params: { page: 1, size: 10 },
  data: { name: 'test' },
  template: 'method:url:params',
  customFunction: 'method:url',
});

const requestKeyResults = ref<any>({});

// ============================================================
// FormData 测试配置
// ============================================================
const formDataInput = reactive({
  simple: { name: '张三', age: 25 },
  nested: {
    user: { name: '李四', profile: { email: 'test@example.com' } },
    tags: ['javascript', 'typescript', 'vue'],
  },
  files: [
    { name: 'file1.txt', type: 'text/plain' },
    { name: 'file2.jpg', type: 'image/jpeg' },
  ],
});

const formDataResult = ref<any>(null);
const typeCheckResult = ref<any>(null);
const flattenResult = ref<any>(null);

// ============================================================
// Config Merge 测试配置
// ============================================================
const mergeConfigBase = reactive({
  baseURL: '/api',
  timeout: 5000,
  headers: { 'Content-Type': 'application/json' },
  token: { enabled: true },
  retry: { maxRetries: 3 },
});

const mergeConfigOverride = reactive({
  timeout: 10000,
  headers: { Authorization: 'Bearer xxx' },
  retry: { maxRetries: 5, exponentialBackoff: true },
  cancel: { enabled: true },
});

const mergeResult = ref<any>(null);

const addLog = (message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
  const now = new Date();
  const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
  logs.value.unshift({ time, message, type });
  if (logs.value.length > 100) logs.value.pop();
};

// ============================================================
// Request Key 测试函数
// ============================================================
const testGenerateRequestKey = () => {
  addLog('=== 测试 generateRequestKey ===', 'info');

  const config = {
    method: requestKeyConfig.method,
    url: requestKeyConfig.url,
    params: requestKeyConfig.params,
    data: requestKeyConfig.data,
  };

  try {
    const key = generateRequestKey(config);
    requestKeyResults.value.generateRequestKey = key;
    addLog(`generateRequestKey(config): "${key}"`, 'success');
  } catch (error: any) {
    addLog(`generateRequestKey 失败: ${error.message}`, 'error');
  }
};

const testCreateGenerateKey = () => {
  addLog('=== 测试 createGenerateKey ===', 'info');

  try {
    const generator = createGenerateKey(requestKeyConfig.template);
    const config = {
      method: requestKeyConfig.method,
      url: requestKeyConfig.url,
      params: requestKeyConfig.params,
    };
    const key = generator(config);
    requestKeyResults.value.createGenerateKey = key;
    addLog(`createGenerateKey("${requestKeyConfig.template}"): "${key}"`, 'success');
  } catch (error: any) {
    addLog(`createGenerateKey 失败: ${error.message}`, 'error');
  }
};

const testNormalizeGenerateKey = () => {
  addLog('=== 测试 normalizeGenerateKey ===', 'info');

  // 测试字符串模板
  try {
    const stringTemplate = 'method:url';
    const normalizedFn = normalizeGenerateKey(stringTemplate);
    const config = {
      method: 'POST',
      url: '/api/test',
    };
    const key = normalizedFn(config);
    addLog(`normalizeGenerateKey(string): "${key}"`, 'success');
    requestKeyResults.value.normalizeString = key;
  } catch (error: any) {
    addLog(`normalizeGenerateKey(string) 失败: ${error.message}`, 'error');
  }

  // 测试函数
  try {
    const customFn = (config: any) => `${config.method}:${config.url}:${config.params?.page || 0}`;
    const normalizedFn = normalizeGenerateKey(customFn);
    const config = {
      method: 'GET',
      url: '/api/users',
      params: { page: 2 },
    };
    const key = normalizedFn(config);
    addLog(`normalizeGenerateKey(function): "${key}"`, 'success');
    requestKeyResults.value.normalizeFunction = key;
  } catch (error: any) {
    addLog(`normalizeGenerateKey(function) 失败: ${error.message}`, 'error');
  }

  // 测试 undefined（返回默认 key）
  try {
    const normalizedFn = normalizeGenerateKey(undefined);
    const config = {
      method: 'DELETE',
      url: '/api/users/1',
    };
    const key = normalizedFn(config);
    addLog(`normalizeGenerateKey(undefined): "${key}"`, 'success');
    requestKeyResults.value.normalizeUndefined = key;
  } catch (error: any) {
    addLog(`normalizeGenerateKey(undefined) 失败: ${error.message}`, 'error');
  }
};

const testAllRequestKeys = () => {
  addLog('=== 测试所有 Request Key 模板变量 ===', 'info');

  const templates = [
    'method',
    'url',
    'params',
    'data',
    'method:url',
    'method:url:params',
    'method:url:data',
    'method:url:params:data',
  ];

  const config = {
    method: 'POST',
    url: '/api/users',
    params: { page: 1 },
    data: { name: 'test' },
  };

  for (const template of templates) {
    try {
      const generator = createGenerateKey(template);
      const key = generator(config);
      addLog(`  "${template}" => "${key}"`, 'success');
    } catch (error: any) {
      addLog(`  "${template}" => 失败: ${error.message}`, 'error');
    }
  }
};

// ============================================================
// FormData 测试函数
// ============================================================
const testToFormData = () => {
  addLog('=== 测试 toFormData ===', 'info');

  try {
    const result = toFormData(formDataInput.simple);
    formDataResult.value = result;
    addLog(`toFormData(simple): 构建成功`, 'success');
    console.log('FormData:', result);
  } catch (error: any) {
    addLog(`toFormData 失败: ${error.message}`, 'error');
  }
};

const testToFormDataNested = () => {
  addLog('=== 测试 toFormData (嵌套对象) ===', 'info');

  try {
    const result = toFormData(formDataInput.nested);
    formDataResult.value = result;
    addLog(`toFormData(nested): 构建成功`, 'success');

    // 遍历 FormData 内容
    result.forEach((value: any, key: string) => {
      addLog(`  ${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`, 'info');
    });
  } catch (error: any) {
    addLog(`toFormData(nested) 失败: ${error.message}`, 'error');
  }
};

const testCheckType = () => {
  addLog('=== 测试 checkType ===', 'info');

  const testCases = [
    { value: 'hello', expected: 'string' },
    { value: 123, expected: 'number' },
    { value: true, expected: 'boolean' },
    { value: { name: 'test' }, expected: 'object' },
    { value: [1, 2, 3], expected: 'array' },
    { value: null, expected: 'null' },
    { value: undefined, expected: 'undefined' },
    { value: new Blob(), expected: 'blob' },
    { value: new File([], 'test.txt'), expected: 'file' },
  ];

  typeCheckResult.value = {};

  for (const testCase of testCases) {
    try {
      const result = checkType(testCase.value);
      const isCorrect = result.type === testCase.expected;
      typeCheckResult.value[testCase.expected] = result;
      addLog(`  checkType(${testCase.expected}): ${result.type} ${isCorrect ? '✓' : '✗'}`, isCorrect ? 'success' : 'error');
    } catch (error: any) {
      addLog(`  checkType(${testCase.expected}) 失败: ${error.message}`, 'error');
    }
  }
};

const testFlattenFormData = () => {
  addLog('=== 测试 flattenFormData ===', 'info');

  try {
    const testData = {
      user: {
        name: '张三',
        profile: {
          email: 'zhangsan@example.com',
        },
      },
      tags: ['javascript', 'typescript'],
      count: 42,
    };

    const result = flattenFormData(testData);
    flattenResult.value = result;

    addLog(`flattenFormData 结果:`, 'success');
    for (const entry of result) {
      addLog(`  ${entry.key} = ${entry.value} (type: ${entry.type})`, 'info');
    }
  } catch (error: any) {
    addLog(`flattenFormData 失败: ${error.message}`, 'error');
  }
};

// ============================================================
// Config Merge 测试函数
// ============================================================
const testDeepMerge = () => {
  addLog('=== 测试 deepMerge ===', 'info');

  try {
    const base = {
      a: 1,
      b: { c: 2, d: 3 },
      e: [1, 2],
    };
    const override = {
      b: { c: 99 },
      e: [3, 4, 5],
      f: 6,
    };

    const result = deepMerge(base, override);
    mergeResult.value = result;

    addLog(`deepMerge 结果:`, 'success');
    addLog(`  a: ${result.a} (保留原值)`, result.a === 1 ? 'success' : 'error');
    addLog(`  b.c: ${result.b.c} (被覆盖)`, result.b.c === 99 ? 'success' : 'error');
    addLog(`  b.d: ${result.b.d} (保留原值)`, result.b.d === 3 ? 'success' : 'error');
    addLog(`  e: ${JSON.stringify(result.e)} (被覆盖)`, result.e.length === 3 ? 'success' : 'error');
    addLog(`  f: ${result.f} (新增)`, result.f === 6 ? 'success' : 'error');
  } catch (error: any) {
    addLog(`deepMerge 失败: ${error.message}`, 'error');
  }
};

const testShallowMerge = () => {
  addLog('=== 测试 shallowMerge ===', 'info');

  try {
    const base = {
      a: 1,
      b: { c: 2, d: 3 },
    };
    const override = {
      b: { c: 99 },
      f: 6,
    };

    const result = shallowMerge(base, override);
    mergeResult.value = result;

    addLog(`shallowMerge 结果:`, 'success');
    addLog(`  a: ${result.a} (保留原值)`, result.a === 1 ? 'success' : 'error');
    addLog(`  b: ${JSON.stringify(result.b)} (被完全覆盖)`, result.b.c === 99 && result.b.d === undefined ? 'success' : 'error');
    addLog(`  f: ${result.f} (新增)`, result.f === 6 ? 'success' : 'error');
  } catch (error: any) {
    addLog(`shallowMerge 失败: ${error.message}`, 'error');
  }
};

const testMergeConfig = () => {
  addLog('=== 测试 mergeConfig ===', 'info');

  try {
    const result = mergeConfig(mergeConfigBase, mergeConfigOverride);
    mergeResult.value = result;

    addLog(`mergeConfig 结果:`, 'success');
    addLog(`  baseURL: ${result.baseURL} (来自 base)`, result.baseURL === '/api' ? 'success' : 'error');
    addLog(`  timeout: ${result.timeout} (来自 override)`, result.timeout === 10000 ? 'success' : 'error');
    addLog(`  token.enabled: ${result.token?.enabled} (来自 base)`, result.token?.enabled === true ? 'success' : 'error');
    addLog(`  retry.maxRetries: ${result.retry?.maxRetries} (来自 override)`, result.retry?.maxRetries === 5 ? 'success' : 'error');
    addLog(`  retry.exponentialBackoff: ${result.retry?.exponentialBackoff} (来自 override)`, result.retry?.exponentialBackoff === true ? 'success' : 'error');
    addLog(`  cancel.enabled: ${result.cancel?.enabled} (新增)`, result.cancel?.enabled === true ? 'success' : 'error');
  } catch (error: any) {
    addLog(`mergeConfig 失败: ${error.message}`, 'error');
  }
};

const testCreateConfigMerger = () => {
  addLog('=== 测试 createConfigMerger ===', 'info');

  try {
    const merger = createConfigMerger({
      arrayMergeMode: 'replace', // 数组替换而非合并
      deep: true,
    });

    const base = {
      tags: ['a', 'b'],
      config: { x: 1 },
    };
    const override = {
      tags: ['c', 'd', 'e'],
      config: { y: 2 },
    };

    const result = merger(base, override);

    addLog(`createConfigMerger 结果:`, 'success');
    addLog(`  tags: ${JSON.stringify(result.tags)} (替换模式)`, result.tags.length === 3 ? 'success' : 'error');
    addLog(`  config.x: ${result.config.x} (保留)`, result.config.x === 1 ? 'success' : 'error');
    addLog(`  config.y: ${result.config.y} (新增)`, result.config.y === 2 ? 'success' : 'error');
  } catch (error: any) {
    addLog(`createConfigMerger 失败: ${error.message}`, 'error');
  }
};

const clearLogs = () => {
  logs.value = [];
  addLog('日志已清除', 'info');
};
</script>

<template>
  <div class="max-w-6xl mx-auto">
    <h2 class="text-2xl font-bold mb-2 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
      工具函数演示
    </h2>

    <p class="text-light/60 mb-6">
      测试 axios-request 导出的所有工具函数，包括请求 key 生成、FormData 转换、配置合并等
    </p>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Request Key -->
      <div class="card-glow">
        <div class="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center mb-4">
          <span class="text-white text-lg">🔑</span>
        </div>
        <h3 class="text-lg font-semibold mb-4">Request Key 生成</h3>

        <div class="space-y-4 text-sm">
          <div>
            <label class="block text-xs text-light/50 mb-1">方法</label>
            <el-input v-model="requestKeyConfig.method" size="small" />
          </div>
          <div>
            <label class="block text-xs text-light/50 mb-1">URL</label>
            <el-input v-model="requestKeyConfig.url" size="small" />
          </div>
          <div>
            <label class="block text-xs text-light/50 mb-1">模板</label>
            <el-input v-model="requestKeyConfig.template" size="small" />
          </div>

          <el-button type="primary" class="w-full" size="small" @click="testGenerateRequestKey">
            generateRequestKey
          </el-button>
          <el-button type="success" class="w-full" size="small" @click="testCreateGenerateKey">
            createGenerateKey
          </el-button>
          <el-button type="warning" class="w-full" size="small" @click="testNormalizeGenerateKey">
            normalizeGenerateKey
          </el-button>
          <el-button type="info" class="w-full" size="small" @click="testAllRequestKeys">
            测试所有模板变量
          </el-button>
        </div>

        <div v-if="requestKeyResults.generateRequestKey" class="mt-4 p-3 bg-dark/30 rounded-lg">
          <div class="text-xs text-light/50 mb-1">结果</div>
          <code class="text-sm text-primary">{{ requestKeyResults.generateRequestKey }}</code>
        </div>
      </div>

      <!-- FormData -->
      <div class="card-glow">
        <div class="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500 to-teal-500 flex items-center justify-center mb-4">
          <span class="text-white text-lg">📋</span>
        </div>
        <h3 class="text-lg font-semibold mb-4">FormData 工具</h3>

        <div class="space-y-3">
          <el-button type="primary" class="w-full" size="small" @click="testToFormData">
            toFormData (简单对象)
          </el-button>
          <el-button type="success" class="w-full" size="small" @click="testToFormDataNested">
            toFormData (嵌套对象)
          </el-button>
          <el-button type="warning" class="w-full" size="small" @click="testCheckType">
            checkType (类型检测)
          </el-button>
          <el-button type="info" class="w-full" size="small" @click="testFlattenFormData">
            flattenFormData (扁平化)
          </el-button>
        </div>

        <div v-if="formDataResult" class="mt-4 p-3 bg-dark/30 rounded-lg">
          <div class="text-xs text-light/50 mb-1">FormData 构建成功</div>
          <div class="text-xs text-success">✓ FormData 实例已创建</div>
        </div>
      </div>

      <!-- Config Merge -->
      <div class="card-glow">
        <div class="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mb-4">
          <span class="text-white text-lg">🔀</span>
        </div>
        <h3 class="text-lg font-semibold mb-4">配置合并</h3>

        <div class="space-y-3">
          <el-button type="primary" class="w-full" size="small" @click="testDeepMerge">
            deepMerge (深度合并)
          </el-button>
          <el-button type="success" class="w-full" size="small" @click="testShallowMerge">
            shallowMerge (浅层合并)
          </el-button>
          <el-button type="warning" class="w-full" size="small" @click="testMergeConfig">
            mergeConfig (配置合并)
          </el-button>
          <el-button type="info" class="w-full" size="small" @click="testCreateConfigMerger">
            createConfigMerger (自定义合并)
          </el-button>
        </div>

        <div v-if="mergeResult" class="mt-4 p-3 bg-dark/30 rounded-lg">
          <div class="text-xs text-light/50 mb-1">合并结果</div>
          <code class="text-xs text-primary">{{ JSON.stringify(mergeResult, null, 2) }}</code>
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
          <div class="text-2xl mb-2">🔑</div>
          <div class="text-sm font-medium mb-1">Request Key</div>
          <div class="text-xs text-light/50 space-y-1">
            <div>generateRequestKey: 生成请求唯一标识</div>
            <div>createGenerateKey: 创建 key 生成器</div>
            <div>normalizeGenerateKey: 标准化 key 配置</div>
          </div>
        </div>
        <div class="p-4 bg-dark/30 rounded-lg">
          <div class="text-2xl mb-2">📋</div>
          <div class="text-sm font-medium mb-1">FormData</div>
          <div class="text-xs text-light/50 space-y-1">
            <div>toFormData: 对象转 FormData</div>
            <div>checkType: 类型检测</div>
            <div>flattenFormData: 扁平化数据</div>
          </div>
        </div>
        <div class="p-4 bg-dark/30 rounded-lg">
          <div class="text-2xl mb-2">🔀</div>
          <div class="text-sm font-medium mb-1">Config Merge</div>
          <div class="text-xs text-light/50 space-y-1">
            <div>deepMerge: 深度合并对象</div>
            <div>shallowMerge: 浅层合并对象</div>
            <div>mergeConfig: 配置合并</div>
          </div>
        </div>
      </div>

      <div class="mt-4">
        <el-button @click="clearLogs" size="large">
          清空日志
        </el-button>
      </div>
    </div>

    <!-- 日志 -->
    <div class="mt-6 card-glow">
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
            <span class="text-white text-lg">📝</span>
          </div>
          <div>
            <h3 class="text-lg font-semibold">测试日志</h3>
            <span class="text-xs text-light/40">{{ logs.length }} 条记录</span>
          </div>
        </div>
        <el-button text @click="clearLogs">清空</el-button>
      </div>

      <div class="bg-dark/50 rounded-lg p-4 max-h-96 overflow-y-auto font-mono text-sm">
        <div v-if="logs.length === 0" class="text-center text-light/40 py-8">
          暂无日志，点击上方按钮开始测试
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
